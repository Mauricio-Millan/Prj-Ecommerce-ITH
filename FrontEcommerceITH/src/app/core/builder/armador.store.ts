import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast';
import { CartApi } from '../cart/cart.api';
import { CatalogApi } from '../catalog/catalog.api';
import { Atributo, Categoria, Producto, ReglaCompatibilidad } from '../catalog/catalog.models';
import { CurrencyService } from '../currency/currency.service';
import { localStore } from '../storage/local-store';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { ARMADO_VACIO, Armado, OMITIDO } from './builder.models';
import { ContextoArmador, estado as calcularEstado, conflictos, obligatorio, pieza, precioCentimos, siguientePendiente } from './builder.logic';
import { PASOS, PasoActual, PasoId } from './pasos';

const KEY = 'armador';

/** Lee de forma síncrona (el catálogo emite síncrono: ver `CatalogApi`). */
function leer<T>(fuente: { subscribe(f: (v: T) => void): { unsubscribe(): void } }, vacio: T): T {
  let valor = vacio;
  fuente.subscribe((v) => (valor = v)).unsubscribe();
  return valor;
}

/**
 * El armador de PC (spec 008). El armado en curso vive en `ts_armador` y sobrevive a recargar (CA-6.1); NO se guarda en la cuenta (D15).
 * Todo lo que se muestra deriva de un solo signal: elegir, omitir o cambiar una pieza actualiza pasos, resumen y conflictos a la vez.
 */
@Injectable({ providedIn: 'root' })
export class ArmadorStore {
  private readonly catalog = inject(CatalogApi);
  private readonly currency = inject(CurrencyService);
  private readonly cart = inject(CartApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly logger = inject(InteractionLogger);

  private readonly _armado = signal<Armado>(this.cargar());
  readonly armado = this._armado.asReadonly();
  /** Verdadero justo después de "Agregar todo al carrito": el armado está vacío y se ofrece "Armar otra PC" (CA-5.4). */
  readonly enviado = signal(false);

  private readonly version = signal(0);
  /** El catálogo se relee al entrar (`refrescar`): el stock pudo cambiar mientras no se armaba (CA-6.3). */
  readonly ctx = computed<ContextoArmador>(() => {
    this.version();
    return {
      productos: leer<readonly Producto[]>(this.catalog.todos(), []),
      categorias: leer<Categoria[]>(this.catalog.categorias(), []),
      reglas: leer<ReglaCompatibilidad[]>(this.catalog.reglas(), []),
    };
  });
  readonly atributos = computed<Atributo[]>(() => {
    this.version();
    return leer<Atributo[]>(this.catalog.atributos(), []);
  });
  /** Tipo de cambio vigente; `null` = el total se muestra en USD de referencia. */
  readonly tc = computed(() => (this.currency.exchangeRate() ? Number(this.currency.exchangeRate()!.valor) : null));
  readonly estado = computed(() => calcularEstado(this._armado(), this.ctx(), this.tc()));

  private cargar(): Armado {
    const g = localStore.get<Armado>(KEY);
    return g && typeof g === 'object' && g.piezas ? { ...ARMADO_VACIO, ...g } : { ...ARMADO_VACIO };
  }

  private guardar(armado: Armado): void {
    this._armado.set(armado);
    localStore.set(KEY, armado);
  }

  refrescar(): void {
    this.version.update((v) => v + 1);
  }

  /** Elige una pieza: se aplica SIEMPRE (los conflictos se marcan, no se bloquea) y avanza al siguiente paso pendiente (CA-1.5, 4.1). */
  elegir(paso: PasoId, sku: string): void {
    const antes = this._armado();
    const previa = antes.piezas[paso];
    const nuevo: Armado = { ...antes, piezas: { ...antes.piezas, [paso]: sku } };
    const clave = (c: { reglaId: number; afectado: PasoId }) => `${c.reglaId}:${c.afectado}`;
    const yaEstaban = new Set(conflictos(antes, this.ctx()).map(clave));
    const nuevos = conflictos(nuevo, this.ctx()).filter((c) => !yaEstaban.has(clave(c)));

    this.logger.track('builder_select', { paso, sku, reemplaza: previa && previa !== OMITIDO ? previa : null });
    if (nuevos.length) this.logger.track('builder_conflict', { pasos: [...new Set(nuevos.map((c) => c.afectado))], causa: paso });
    this.guardar({ ...nuevo, pasoActual: siguientePendiente(paso, nuevo) });
  }

  /** Solo los pasos opcionales se omiten (CA-1.6). */
  omitir(paso: PasoId): void {
    const antes = this._armado();
    if (obligatorio(paso, antes, this.ctx()).obligatorio) return;
    const nuevo: Armado = { ...antes, piezas: { ...antes.piezas, [paso]: OMITIDO } };
    this.guardar({ ...nuevo, pasoActual: siguientePendiente(paso, nuevo) });
  }

  quitar(paso: PasoId): void {
    const { [paso]: _, ...resto } = this._armado().piezas;
    this.guardar({ ...this._armado(), piezas: resto, pasoActual: paso });
  }

  irA(paso: PasoActual): void {
    this.guardar({ ...this._armado(), pasoActual: paso });
  }

  fijarPresupuesto(centimos: number | null): void {
    this.guardar({ ...this._armado(), presupuestoCentimos: centimos });
  }

  /** Vacía el armado (la confirmación la pide la página: CA-6.2). */
  reiniciar(): void {
    this.enviado.set(false);
    this.guardar({ ...ARMADO_VACIO, piezas: {} });
  }

  /** Todas las piezas en UNA operación, con un solo aviso y un solo "Deshacer" (CA-5.3, 005 CA-6.1). Después el armado se vacía (CA-5.4). */
  enviarAlCarrito(): void {
    const e = this.estado();
    if (!e.completo) return;
    const armado = this._armado();
    const ctx = this.ctx();
    const elegidas = PASOS.map((p) => pieza(armado, p.id, ctx)).filter((p): p is Producto => p !== null);

    const { agregadas } = this.cart.agregarVarios(elegidas.map((p) => ({ sku: p.sku, cantidad: 1, stock: p.stock })));
    if (agregadas === 0) return;

    this.toast.show(
      'cart.batch',
      'exito',
      [
        { clave: 'cart.view', ejecutar: () => this.router.navigateByUrl('/carrito') },
        {
          clave: 'cart.undo',
          ejecutar: () => {
            this.cart.deshacerUltimo();
            this.logger.track('undo', { accion: 'armado' });
          },
        },
      ],
      { n: elegidas.length },
      { duracionMs: 10_000, pausarAlEnfocar: true },
    );
    this.logger.track('builder_complete', {
      piezas: elegidas.length,
      total_pen: e.totalCentimos,
      presupuesto_pen: armado.presupuestoCentimos,
      dentro_presupuesto: armado.presupuestoCentimos === null ? null : e.totalCentimos <= armado.presupuestoCentimos,
    });
    this.guardar({ ...ARMADO_VACIO, piezas: {} });
    this.enviado.set(true);
  }

  /** "+S/ X" de una pieza frente a la que ya había elegida en su paso, y lo que quedaría del presupuesto (CA-3.4). */
  costoDe(producto: Producto, paso: PasoId): { incremento: number; quedaria: number | null } {
    const actual = pieza(this._armado(), paso, this.ctx());
    const incremento = precioCentimos(producto, this.tc()) - (actual ? precioCentimos(actual, this.tc()) : 0);
    const restante = this.estado().restanteCentimos;
    return { incremento, quedaria: restante === null ? null : restante - incremento };
  }
}
