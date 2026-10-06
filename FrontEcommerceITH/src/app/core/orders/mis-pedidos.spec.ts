import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Usuario } from '../auth/session.api';
import { SessionApi } from '../auth/session.api';
import { CartApi } from '../cart/cart.api';
import { CatalogApi } from '../catalog/catalog.api';
import { Producto } from '../catalog/catalog.models';
import { CurrencyService } from '../currency/currency.service';
import { ExchangeRateApi } from '../currency/exchange-rate.api';
import { localStore } from '../storage/local-store';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { OrdersApi } from './orders.api';
import { estadoActual, seguimiento, visibles } from './orders.logic';
import { EstadoPedido, ItemPedido, Pedido } from './orders.models';
import { Reorder } from './reorder';

const item = (sku: string, pen: number, cantidad = 1, usd = 10): ItemPedido => ({ sku, nombre_producto: `Producto ${sku}`, imagen: '', precio_unitario_usd: usd, precio_unitario_pen_centimos: pen, cantidad, subtotal_pen_centimos: pen * cantidad });

/** Pedido de prueba: `historial` son los estados alcanzados con su fecha (día de octubre de 2026). */
const pedido = (codigo: string, usuarioId: string, historial: [EstadoPedido, number][], items: ItemPedido[] = [item('A', 3750)]): Pedido => {
  const h = historial.map(([estado, dia]) => ({ estado, fecha: `2026-10-${String(dia).padStart(2, '0')}T10:00:00.000Z` }));
  return {
    codigo, usuarioId, estado: h[h.length - 1].estado, firma: codigo, tipo_cambio: 3.75, igv_tasa: 0.18, total_pen_centimos: 3750, op_gravada_pen_centimos: 3178, igv_pen_centimos: 572, total_usd_centimos: 1000,
    comprobante: 'boleta', comprobante_nombre: 'Juan', comprobante_dni: '12345678', envio: {} as never, items, pagos: [], historial_estados: h, created_at: h[0].fecha,
  };
};

describe('orders.logic: Mis pedidos (spec 007)', () => {
  it('visibles: solo los cobrados del usuario, del más reciente al más antiguo', () => {
    const lista = [
      pedido('viejo', 'u1', [['pendiente_pago', 1], ['pagado', 2]]),
      pedido('pendiente', 'u1', [['pendiente_pago', 5]]),
      pedido('cancelado-antes', 'u1', [['pendiente_pago', 6], ['cancelado', 7]]),
      pedido('cancelado-despues', 'u1', [['pendiente_pago', 8], ['pagado', 9], ['cancelado', 10]]),
      pedido('ajeno', 'u2', [['pendiente_pago', 11], ['pagado', 12]]),
      pedido('reciente', 'u1', [['pendiente_pago', 13], ['pagado', 14]]),
    ];
    expect(visibles(lista, 'u1').map((p) => p.codigo)).toEqual(['reciente', 'cancelado-despues', 'viejo']);
  });

  it('seguimiento: pagado → Pagado con fecha y Enviado/Entregado pendientes', () => {
    const pasos = seguimiento(pedido('x', 'u1', [['pendiente_pago', 1], ['pagado', 2]]));
    expect(pasos.map((p) => p.estado)).toEqual(['pagado', 'enviado', 'entregado']);
    expect(pasos.map((p) => p.fecha !== null)).toEqual([true, false, false]);
    expect(pasos.filter((p) => p.actual).map((p) => p.estado)).toEqual(['pagado']);
  });

  it('seguimiento: avanza con las fechas del historial y marca el último paso alcanzado', () => {
    const p = pedido('x', 'u1', [['pendiente_pago', 1], ['pagado', 2], ['enviado', 3]]);
    expect(estadoActual(p)).toBe('enviado');
    expect(seguimiento(p).find((s) => s.actual)?.estado).toBe('enviado');
  });

  it('seguimiento: un pedido cancelado después de pagar termina en "Cancelado"', () => {
    const pasos = seguimiento(pedido('x', 'u1', [['pendiente_pago', 1], ['pagado', 2], ['cancelado', 3]]));
    expect(pasos.map((p) => p.estado)).toEqual(['pagado', 'cancelado']);
    expect(pasos.find((p) => p.actual)?.estado).toBe('cancelado');
  });
});

describe('OrdersApi.listar y Reorder', () => {
  const usuario = { id: 'u1', email: 'a@b.co', nombres: 'A', apellidos: 'B', dni: null, telefono: null, rol: 'cliente' } as Usuario;
  let productos: Producto[];
  let tc: { valor: string; fecha: string };
  let eventos: { tipo: string; datos?: Record<string, unknown> }[];

  const prod = (sku: string, precio_usd: number, stock: number, activo = true) => ({ sku, nombre: `Producto ${sku}`, precio_usd, stock, activo, imagenes: [] }) as unknown as Producto;

  beforeEach(() => {
    for (const k of localStore.keys().filter((x) => x.startsWith('carrito') || x === 'pedidos')) localStore.remove(k);
    productos = [prod('A', 10, 5), prod('B', 20, 0), prod('C', 30, 5, false)];
    tc = { valor: '3.75', fecha: '2026-10-05' };
    eventos = [];
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SessionApi, useValue: { usuario: signal<Usuario | null>(usuario) } },
        { provide: CatalogApi, useValue: { todos: () => of(productos) } },
        { provide: ExchangeRateApi, useValue: { obtenerVigente: () => of(tc) } },
        { provide: CurrencyService, useValue: { exchangeRate: () => tc } },
        { provide: InteractionLogger, useValue: { track: (tipo: string, datos?: Record<string, unknown>) => eventos.push({ tipo, datos }) } },
      ],
    });
  });
  afterEach(() => {
    for (const k of localStore.keys().filter((x) => x.startsWith('carrito') || x === 'pedidos')) localStore.remove(k);
  });

  it('listar: con 23 pedidos, la página 3 tiene 3 y la 1 trae 10 (los más recientes primero)', () => {
    const todos = Array.from({ length: 23 }, (_, i) => pedido(`P${i + 1}`, 'u1', [['pendiente_pago', 1], ['pagado', (i % 28) + 1]]));
    localStore.set('pedidos', todos);
    const api = TestBed.inject(OrdersApi);
    expect(api.listar('u1', { pagina: 3 }).items.length).toBe(3);
    expect(api.listar('u1', { pagina: 1 }).items.length).toBe(10);
    expect(api.listar('u1', { pagina: 1 }).total).toBe(23);
    expect(api.listar('u2', { pagina: 1 }).total).toBe(0);
  });

  it('volver a comprar con todo en stock: agrega todo en una operación con un solo "Deshacer"', () => {
    productos = [prod('A', 10, 5), prod('D', 5, 9)];
    const cart = TestBed.inject(CartApi);
    const r = TestBed.inject(Reorder).volverAComprar(pedido('x', 'u1', [['pagado', 2]], [item('A', 3750, 2), item('D', 1875, 3, 5)]));

    expect(r).toEqual({ agregados: 2, agotados: [], noDisponibles: [], preciosCambiaron: false });
    expect(cart.items()).toEqual([{ sku: 'A', cantidad: 2 }, { sku: 'D', cantidad: 3 }]);
    cart.deshacerUltimo();
    expect(cart.items()).toEqual([]);
    expect(eventos.find((e) => e.tipo === 'reorder')?.datos).toEqual({ codigo: 'x', agregados: 2, no_disponibles: 0 });
  });

  it('con un producto agotado y otro inexistente: los informa y agrega el resto', () => {
    const cart = TestBed.inject(CartApi);
    const r = TestBed.inject(Reorder).volverAComprar(pedido('x', 'u1', [['pagado', 2]], [item('A', 3750), item('B', 7500, 1, 20), item('C', 11250, 1, 30), item('Z', 100)]));

    expect(r.agregados).toBe(1);
    expect(r.agotados).toEqual(['Producto B']);
    expect(r.noDisponibles).toEqual(['Producto C', 'Producto Z']);
    expect(cart.items()).toEqual([{ sku: 'A', cantidad: 1 }]);
  });

  it('con el tipo de cambio cambiado desde el pedido: preciosCambiaron = true; y se limita al stock', () => {
    tc = { valor: '3.80', fecha: '2026-10-06' };
    const cart = TestBed.inject(CartApi);
    const r = TestBed.inject(Reorder).volverAComprar(pedido('x', 'u1', [['pagado', 2]], [item('A', 3750, 9)]));
    expect(r.preciosCambiaron).toBeTrue();
    expect(cart.items()).toEqual([{ sku: 'A', cantidad: 5 }]);
  });

  it('si no se pudo agregar nada: agregados = 0 y el carrito sigue igual', () => {
    const cart = TestBed.inject(CartApi);
    const r = TestBed.inject(Reorder).volverAComprar(pedido('x', 'u1', [['pagado', 2]], [item('B', 7500, 1, 20)]));
    expect(r.agregados).toBe(0);
    expect(cart.items()).toEqual([]);
  });
});
