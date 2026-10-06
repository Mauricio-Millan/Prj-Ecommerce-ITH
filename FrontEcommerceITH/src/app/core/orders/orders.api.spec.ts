import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Usuario } from '../auth/session.api';
import { CartApi } from '../cart/cart.api';
import { detallar } from '../cart/cart.logic';
import { CatalogApi } from '../catalog/catalog.api';
import { Producto } from '../catalog/catalog.models';
import { ExchangeRateApi } from '../currency/exchange-rate.api';
import { SessionApi } from '../auth/session.api';
import { localStore } from '../storage/local-store';
import { OrdersApi } from './orders.api';
import { Envio, ResultadoPago } from './orders.models';

const usuario: Usuario = { id: 'u-cliente2', email: 'cliente2@gmail.com', nombres: 'Juan', apellidos: 'Pérez Quispe', dni: '12345678', telefono: '987654321', rol: 'cliente' };
const envio: Envio = { ubigeo_id: '150122', departamento: 'Lima', provincia: 'Lima', distrito: 'Miraflores', direccion: 'Av. Larco 123', referencia: '', destinatario: 'Juan', telefono: '987654321' };
const prod = (sku: string, precio_usd: number, stock: number) => ({ sku, nombre: `Producto ${sku}`, precio_usd, stock, activo: true, imagenes: [] }) as unknown as Producto;

describe('OrdersApi (plan § 10)', () => {
  let productos: Producto[];
  let tc: { valor: string; fecha: string } | null;
  let escrituras: Record<string, number>[];
  let api: OrdersApi;
  let cart: CartApi;

  const lineas = () => detallar(cart.items(), productos, Number(tc!.valor));
  const preparar = () => api.prepararPedido(lineas(), Number(tc!.valor), usuario, envio);
  /** Avanza el reloj simulado hasta que la pasarela responde. */
  const pagar = async (codigo: string, metodo: 'tarjeta' | 'yape', dato: { numero?: string; codigo?: string }): Promise<ResultadoPago> => {
    const r = firstValueFrom(api.pagar(codigo, metodo, dato));
    jasmine.clock().tick(10_001);
    return r;
  };

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
    for (const k of localStore.keys().filter((x) => x.startsWith('carrito') || x === 'pedidos' || x === 'pedido_seq' || x.startsWith('perfil_'))) localStore.remove(k);
    productos = [prod('A', 10, 5), prod('B', 20, 5)];
    tc = { valor: '3.75', fecha: '2026-10-05' };
    escrituras = [];
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SessionApi, useValue: { usuario: signal<Usuario | null>(usuario), actualizarPerfil: () => {} } },
        {
          provide: CatalogApi,
          useValue: {
            todos: () => of(productos),
            reemplazarStock: (m: Record<string, number>) => {
              escrituras.push(m);
              productos = productos.map((p) => (p.sku in m ? { ...p, stock: m[p.sku] } : p));
            },
          },
        },
        { provide: ExchangeRateApi, useValue: { obtenerVigente: () => of(tc) } },
      ],
    });
    cart = TestBed.inject(CartApi);
    api = TestBed.inject(OrdersApi);
    cart.agregar('A', 2, 5);
    cart.agregar('B', 1, 5);
  });
  afterEach(() => {
    jasmine.clock().uninstall();
    for (const k of localStore.keys().filter((x) => x.startsWith('carrito') || x === 'pedidos' || x === 'pedido_seq' || x.startsWith('perfil_'))) localStore.remove(k);
  });

  it('prepararPedido crea el código TS-<año>-<correlativo> y el pedido queda pendiente de pago', () => {
    const p = preparar();
    expect(p.codigo).toMatch(/^TS-\d{4}-000001$/);
    expect([p.estado, p.total_pen_centimos]).toEqual(['pendiente_pago', 2 * 3750 + 7500]);
    expect(api.obtener(p.codigo, usuario.id)?.codigo).toBe(p.codigo);
    expect(api.obtener(p.codigo, 'otro-usuario')).toBeNull();
  });

  it('con stock insuficiente NO cobra: devuelve SIN_STOCK, registra "sin_stock" y no toca el stock', async () => {
    const p = preparar();
    productos = [prod('A', 10, 1), prod('B', 20, 5)];
    const r = await pagar(p.codigo, 'tarjeta', { numero: '4111111111111111' });

    expect(r).toEqual({ tipo: 'SIN_STOCK', faltantes: [{ sku: 'A', nombre: 'Producto A', pedido: 2, disponible: 1 }] });
    expect(escrituras).toEqual([]);
    expect(api.obtener(p.codigo, usuario.id)!.pagos.map((x) => x.resultado)).toEqual(['sin_stock']);
  });

  it('con el tipo de cambio cambiado devuelve TOTAL_CAMBIO sin cobrar', async () => {
    const p = preparar();
    tc = { valor: '3.80', fecha: '2026-10-06' };
    const r = await pagar(p.codigo, 'tarjeta', { numero: '4111111111111111' });

    expect(r).toEqual({ tipo: 'TOTAL_CAMBIO', antes: p.total_pen_centimos, despues: 2 * 3800 + 7600 });
    expect(api.obtener(p.codigo, usuario.id)!.pagos).toEqual([]);
    expect(escrituras).toEqual([]);
  });

  it('aprobado: stock descontado en UNA escritura, pedido pagado, carrito vacío y último medio guardado', async () => {
    const p = preparar();
    const r = await pagar(p.codigo, 'tarjeta', { numero: '4111 1111 1111 1111' });

    expect(r.tipo).toBe('aprobado');
    expect(escrituras).toEqual([{ A: 3, B: 4 }]);
    const guardado = api.obtener(p.codigo, usuario.id)!;
    expect([guardado.estado, guardado.pagos[0].resultado, guardado.pagos[0].metodo]).toEqual(['pagado', 'aprobado', 'tarjeta']);
    expect(guardado.historial_estados.map((h) => h.estado)).toEqual(['pendiente_pago', 'pagado']);
    expect(cart.items()).toEqual([]);
    expect(localStore.get<{ ultimoMetodo: string }>(`perfil_${usuario.id}`)?.ultimoMetodo).toBe('tarjeta');
  });

  it('el pedido guardado no contiene ningún dato del medio de pago (CA-4.6)', async () => {
    const p = preparar();
    await pagar(p.codigo, 'yape', { codigo: '482913' });
    const crudo = localStorage.getItem('ts_pedidos')!;
    expect(crudo).not.toContain('482913');
    expect(crudo).not.toContain('4111');
  });

  it('rechazado: stock intacto, el pedido sigue pendiente y el carrito se conserva', async () => {
    const p = preparar();
    const r = await pagar(p.codigo, 'tarjeta', { numero: '4000 0000 0000 0002' });

    expect(r.tipo).toBe('rechazado');
    expect(escrituras).toEqual([]);
    expect(api.obtener(p.codigo, usuario.id)!.estado).toBe('pendiente_pago');
    expect(cart.cantidadTotal()).toBe(3);
  });

  it('sin respuesta (10 s): no se cobra y se puede reintentar con el MISMO pedido', async () => {
    const p = preparar();
    expect((await pagar(p.codigo, 'yape', { codigo: '999999' })).tipo).toBe('sin_respuesta');
    expect(preparar().codigo).toBe(p.codigo);
    expect((await pagar(p.codigo, 'yape', { codigo: '123456' })).tipo).toBe('aprobado');
    expect(api.obtener(p.codigo, usuario.id)!.pagos.map((x) => x.resultado)).toEqual(['sin_respuesta', 'aprobado']);
  });

  it('rechazado con tarjeta y aprobado con Yape usan el mismo pedido, sin duplicados', async () => {
    const p = preparar();
    await pagar(p.codigo, 'tarjeta', { numero: '4000000000000002' });
    const otra = preparar();
    expect(otra.codigo).toBe(p.codigo);
    expect((await pagar(otra.codigo, 'yape', { codigo: '123456' })).tipo).toBe('aprobado');
    expect(JSON.parse(localStorage.getItem('ts_pedidos')!).length).toBe(1);
  });

  it('si el carrito cambia, el pedido pendiente anterior se cancela y se crea uno nuevo', () => {
    const p = preparar();
    cart.agregar('A', 1, 5);
    const nuevo = preparar();
    expect(nuevo.codigo).not.toBe(p.codigo);
    expect(api.obtener(p.codigo, usuario.id)!.estado).toBe('cancelado');
    expect(nuevo.estado).toBe('pendiente_pago');
  });

  it('un pedido ya pagado no se puede pagar de nuevo', async () => {
    const p = preparar();
    await pagar(p.codigo, 'tarjeta', { numero: '4111111111111111' });
    expect((await pagar(p.codigo, 'tarjeta', { numero: '4111111111111111' })).tipo).toBe('NO_ENCONTRADO');
  });
});
