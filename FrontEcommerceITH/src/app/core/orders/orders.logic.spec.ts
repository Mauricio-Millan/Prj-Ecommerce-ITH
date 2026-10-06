import { LineaDetalle } from '../cart/cart.models';
import { detallar } from '../cart/cart.logic';
import { Producto } from '../catalog/catalog.models';
import { desglosarIgv } from '../currency/igv';
import { construirPedido, descontar, faltantes, firma } from './orders.logic';
import { Envio } from './orders.models';
import { departamentos, distritos, provincias, Ubigeo } from '../checkout/ubigeo.logic';

const envio: Envio = { ubigeo_id: '150122', departamento: 'Lima', provincia: 'Lima', distrito: 'Miraflores', direccion: 'Av. Larco 123', referencia: '', destinatario: 'Ana', telefono: '987654321' };
const titular = { nombres: 'Juan', apellidos: 'Pérez Quispe', dni: '12345678' };
const prod = (sku: string, precio_usd: number, stock: number) => ({ sku, nombre: `Producto ${sku}`, precio_usd, stock, activo: true, imagenes: [{ url: `/${sku}.svg`, alt: '', orden: 1 }] }) as Producto;

describe('igv.desglosarIgv', () => {
  it('desglosa desde el total (no suma) y siempre cuadra', () => {
    expect(desglosarIgv(331875)).toEqual({ opGravada: 281250, igv: 50625 });
    expect(desglosarIgv(74250)).toEqual({ opGravada: 62924, igv: 11326 });
    for (let i = 0; i < 100; i++) {
      const total = Math.floor(Math.random() * 5_000_000);
      const d = desglosarIgv(total);
      expect(d.opGravada + d.igv).toBe(total);
    }
  });
});

describe('orders.logic', () => {
  const combo = [199, 159, 59, 299, 55, 49, 65].map((u, i) => prod(`P${i}`, u, 5));
  const lineas = (cat: Producto[], cantidad = 1, tc = 3.75): LineaDetalle[] => detallar(cat.map((p) => ({ sku: p.sku, cantidad })), cat, tc);

  it('construirPedido: el combo AM5 suma 331875 con su desglose y el comprobante a nombre del titular', () => {
    const p = construirPedido(lineas(combo), 3.75, 'u1', titular, envio, 'TS-2026-000001', '2026-10-05T10:00:00Z');
    expect(p.total_pen_centimos).toBe(331875);
    expect([p.op_gravada_pen_centimos, p.igv_pen_centimos]).toEqual([281250, 50625]);
    expect(p.total_usd_centimos).toBe(88500);
    expect([p.comprobante, p.comprobante_nombre, p.comprobante_dni, p.estado]).toEqual(['boleta', 'Juan Pérez Quispe', '12345678', 'pendiente_pago']);
    expect(p.items[0]).toEqual(jasmine.objectContaining({ sku: 'P0', precio_unitario_usd: 199, precio_unitario_pen_centimos: 74625, subtotal_pen_centimos: 74625 }));
    expect(p.historial_estados.map((h) => h.estado)).toEqual(['pendiente_pago']);
  });

  it('el total del pedido es la suma de los subtotales ya redondeados por unidad', () => {
    const p = construirPedido(lineas([prod('A', 12.9, 9)], 3), 3.75, 'u1', titular, envio, 'TS-2026-000002', '2026-10-05T10:00:00Z');
    expect(p.items[0].subtotal_pen_centimos).toBe(14514);
    expect(p.total_pen_centimos).toBe(14514);
  });

  it('la firma cambia con la cantidad, el precio o el tipo de cambio', () => {
    const base = firma(lineas([prod('A', 10, 9)]), 3.75);
    expect(firma(lineas([prod('A', 10, 9)], 2), 3.75)).not.toBe(base);
    expect(firma(lineas([prod('A', 11, 9)]), 3.75)).not.toBe(base);
    expect(firma(lineas([prod('A', 10, 9)], 1, 3.8), 3.8)).not.toBe(base);
    expect(firma(lineas([prod('A', 10, 9)]), 3.75)).toBe(base);
  });

  it('faltantes dice "pediste 3, quedan 1"; descontar no modifica el catálogo original', () => {
    const cat = [prod('A', 10, 5), prod('B', 10, 5)];
    const pedido = construirPedido(lineas(cat, 3), 3.75, 'u1', titular, envio, 'TS-2026-000003', '2026-10-05T10:00:00Z');
    const bajo = [prod('A', 10, 1), prod('B', 10, 5)];
    expect(faltantes(pedido, bajo)).toEqual([{ sku: 'A', nombre: 'Producto A', pedido: 3, disponible: 1 }]);
    expect(faltantes(pedido, cat)).toEqual([]);

    const nuevo = descontar(cat, pedido);
    expect(nuevo.map((p) => p.stock)).toEqual([2, 2]);
    expect(cat.map((p) => p.stock)).toEqual([5, 5]);
  });
});

describe('ubigeo.logic', () => {
  let lista: Ubigeo[];
  beforeAll(async () => (lista = await (await fetch('data/seed/ubigeos.json')).json()));

  it('los selectores dependen del anterior: Lima no incluye provincias ni distritos de Arequipa', () => {
    expect(provincias(lista, 'Lima')).toContain('Lima');
    expect(provincias(lista, 'Lima')).not.toContain('Camaná');
    expect(distritos(lista, 'Lima', 'Lima').map((d) => d.distrito)).toContain('Miraflores');
    expect(distritos(lista, 'Lima', 'Lima').map((d) => d.distrito)).not.toContain('Cayma');
  });

  it('sin elegir el anterior devuelve []; hay al menos 6 departamentos y 3 distritos por provincia', () => {
    expect(provincias(lista, '')).toEqual([]);
    expect(distritos(lista, 'Lima', '')).toEqual([]);
    expect(departamentos(lista).length).toBeGreaterThanOrEqual(6);
    for (const dep of departamentos(lista)) for (const prov of provincias(lista, dep)) expect(distritos(lista, dep, prov).length).withContext(`${dep}/${prov}`).toBeGreaterThanOrEqual(3);
  });

  it('están ordenados alfabéticamente', () => {
    const nombres = distritos(lista, 'Lima', 'Lima').map((d) => d.distrito);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
