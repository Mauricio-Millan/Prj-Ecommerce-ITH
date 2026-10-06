import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, take } from 'rxjs';
import { PerfilApi } from '../account/perfil.api';
import { Usuario } from '../auth/session.api';
import { CartApi } from '../cart/cart.api';
import { detallar, resumen } from '../cart/cart.logic';
import { LineaDetalle } from '../cart/cart.models';
import { CatalogApi } from '../catalog/catalog.api';
import { ExchangeRateApi } from '../currency/exchange-rate.api';
import { localStore } from '../storage/local-store';
import { paginar } from '../catalog/catalog.logic';
import { Pagina } from '../catalog/catalog.models';
import { construirPedido, descontar, faltantes, firma, visibles } from './orders.logic';
import { Envio, MetodoPago, Pago, Pedido, ResultadoPago } from './orders.models';
import { DatoPago, simular } from './payment-simulator';

const KEY_PEDIDOS = 'pedidos';
const KEY_SEQ = 'pedido_seq';

/**
 * Pedido y pago (spec 006). En la Fase 2 este servicio llama al backend (`confirmar_pago` en una transacción); aquí todo ocurre en el navegador.
 * Orden de `pagar`: recalcular → validar stock → cobrar (simulado). Nunca se cobra un monto distinto al que el usuario vio ni lo que no hay (CA-3.4, 5.4).
 */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly cart = inject(CartApi);
  private readonly catalog = inject(CatalogApi);
  private readonly rates = inject(ExchangeRateApi);
  private readonly perfil = inject(PerfilApi);

  private todos = (): Pedido[] => localStore.get<Pedido[]>(KEY_PEDIDOS) ?? [];

  /** Guarda el pedido (nuevo o actualizado) dentro de la lista. */
  private guardar(pedido: Pedido): void {
    const resto = this.todos().filter((p) => p.codigo !== pedido.codigo);
    localStore.set(KEY_PEDIDOS, [...resto, pedido]);
  }

  private siguienteCodigo(fecha: Date): string {
    const n = (localStore.get<number>(KEY_SEQ) ?? 0) + 1;
    localStore.set(KEY_SEQ, n);
    return `TS-${fecha.getFullYear()}-${String(n).padStart(6, '0')}`;
  }

  /**
   * Reintentar usa el MISMO pedido mientras el carrito no cambie; si cambió, el pendiente anterior se cancela y se crea uno nuevo (CA-5.5).
   * El envío y el comprobante se actualizan por si el usuario los editó entre intentos.
   */
  prepararPedido(lineas: readonly LineaDetalle[], tc: number, usuario: Usuario, envio: Envio): Pedido {
    const ahora = new Date();
    const fecha = ahora.toISOString();
    const nueva = firma(lineas, tc);
    const pendientes = this.todos().filter((p) => p.usuarioId === usuario.id && p.estado === 'pendiente_pago');

    const igual = pendientes.find((p) => p.firma === nueva);
    for (const p of pendientes.filter((x) => x !== igual)) {
      this.guardar({ ...p, estado: 'cancelado', historial_estados: [...p.historial_estados, { estado: 'cancelado', fecha }] });
    }
    if (igual) {
      const actualizado = { ...igual, envio, comprobante_nombre: `${usuario.nombres} ${usuario.apellidos}`.trim(), comprobante_dni: usuario.dni ?? '' };
      this.guardar(actualizado);
      return actualizado;
    }

    const pedido = construirPedido(lineas, tc, usuario.id, { nombres: usuario.nombres, apellidos: usuario.apellidos, dni: usuario.dni ?? '' }, envio, this.siguienteCodigo(ahora), fecha);
    this.guardar(pedido);
    return pedido;
  }

  pagar(codigo: string, metodo: MetodoPago, dato: DatoPago): Observable<ResultadoPago> {
    return forkJoin({ catalogo: this.catalog.todos().pipe(take(1)), tc: this.rates.obtenerVigente().pipe(take(1)) }).pipe(
      switchMap(({ catalogo, tc }) => {
        const pedido = this.todos().find((p) => p.codigo === codigo);
        if (!pedido || pedido.estado !== 'pendiente_pago') return of<ResultadoPago>({ tipo: 'NO_ENCONTRADO' });

        // 1. Recalcular con el catálogo y el tipo de cambio ACTUALES: si algo cambió, no se cobra (CA-3.4).
        const tcActual = tc ? Number(tc.valor) : null;
        const lineas = detallar(this.cart.items(), catalogo, tcActual);
        if (tcActual === null || firma(lineas, tcActual) !== pedido.firma) {
          return of<ResultadoPago>({ tipo: 'TOTAL_CAMBIO', antes: pedido.total_pen_centimos, despues: resumen(lineas).totalPenCentimos });
        }

        // 2. Validar el stock ANTES de cobrar (CA-5.4).
        const sinStock = faltantes(pedido, catalogo);
        if (sinStock.length) {
          this.registrarPago(pedido, metodo, 'sin_stock', null);
          return of<ResultadoPago>({ tipo: 'SIN_STOCK', faltantes: sinStock });
        }

        // 3. Cobro simulado. El dato (tarjeta, código) solo viaja hasta aquí: nunca se guarda (CA-4.6).
        return simular(metodo, dato).pipe(
          map(({ resultado, referencia }): ResultadoPago => {
            const registrado = this.registrarPago(pedido, metodo, resultado, referencia);
            if (resultado !== 'aprobado') return { tipo: resultado, pedido: registrado };

            // 4. Aprobado: una sola escritura del stock, pedido pagado, carrito vacío.
            const nuevoCatalogo = descontar(catalogo, registrado);
            this.catalog.reemplazarStock(Object.fromEntries(registrado.items.map((i) => [i.sku, nuevoCatalogo.find((p) => p.sku === i.sku)!.stock])));
            const pagado: Pedido = { ...registrado, estado: 'pagado', historial_estados: [...registrado.historial_estados, { estado: 'pagado', fecha: new Date().toISOString() }] };
            this.guardar(pagado);
            this.cart.vaciar();
            this.perfil.guardarUltimoMetodo(pagado.usuarioId, metodo);
            return { tipo: 'aprobado', pedido: pagado };
          }),
        );
      }),
    );
  }

  private registrarPago(pedido: Pedido, metodo: MetodoPago, resultado: Pago['resultado'], referencia: string | null): Pedido {
    const pago: Pago = { metodo, resultado, monto_pen_centimos: pedido.total_pen_centimos, referencia, fecha: new Date().toISOString() };
    const actualizado = { ...pedido, pagos: [...pedido.pagos, pago] };
    this.guardar(actualizado);
    return actualizado;
  }

  /** Mis pedidos: los pagados del usuario, del más reciente al más antiguo, de 10 en 10 (spec 007, CA-1.1, 1.5, 1.6). */
  listar(usuarioId: string, { pagina, tamano = 10 }: { pagina: number; tamano?: number }): Pagina<Pedido> {
    return paginar(visibles(this.todos(), usuarioId), pagina, tamano);
  }

  /** El pedido solo si es del usuario (CA-6.4). */
  obtener(codigo: string, usuarioId: string): Pedido | null {
    const p = this.todos().find((x) => x.codigo === codigo);
    return p && p.usuarioId === usuarioId ? p : null;
  }
}
