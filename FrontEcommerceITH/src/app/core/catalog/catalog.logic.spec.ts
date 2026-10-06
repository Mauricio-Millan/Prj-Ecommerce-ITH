import { Atributo, Producto } from './catalog.models';
import { especificacionesOrdenadas, estadoStock, ordenar, paginar } from './catalog.logic';

const prod = (id: number, extra: Partial<Producto> = {}): Producto => ({
  id, sku: `S${id}`, categoria_id: 1, marca_id: 1, nombre: `P${id}`, modelo: 'm', descripcion: '', numero_parte: null, precio_usd: 10, stock: 5, garantia_meses: 0,
  condicion: 'nuevo', especificaciones: {}, imagenes: [], destacado: false, activo: true, created_at: '2026-01-01T00:00:00Z', ...extra,
});

describe('catalog.logic', () => {
  it('destacados: los agotados van al final y luego los destacados (CA-4.3)', () => {
    const lista = [prod(1, { stock: 0, destacado: true }), prod(2), prod(3, { destacado: true }), prod(4)];
    expect(ordenar(lista, 'destacados').map((p) => p.id)).toEqual([3, 2, 4, 1]);
  });

  it('precio asc/desc y más nuevos (CA-3.5), sin modificar la lista original', () => {
    const lista = [prod(1, { precio_usd: 30, created_at: '2026-03-01T00:00:00Z' }), prod(2, { precio_usd: 10, created_at: '2026-05-01T00:00:00Z' }), prod(3, { precio_usd: 20 })];
    expect(ordenar(lista, 'precio-asc').map((p) => p.id)).toEqual([2, 3, 1]);
    expect(ordenar(lista, 'precio-desc').map((p) => p.id)).toEqual([1, 3, 2]);
    expect(ordenar(lista, 'nuevos').map((p) => p.id)).toEqual([2, 1, 3]);
    expect(lista.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('paginar(40, 2, 12) → ítems 13–24 y total 40 (CA-3.6)', () => {
    const lista = Array.from({ length: 40 }, (_, i) => i + 1);
    const p = paginar(lista, 2, 12);
    expect(p.items[0]).toBe(13);
    expect(p.items.at(-1)).toBe(24);
    expect(p.total).toBe(40);
  });

  it('paginar ajusta páginas fuera de rango', () => {
    const lista = [1, 2, 3];
    expect(paginar(lista, 99, 2).pagina).toBe(2);
    expect(paginar(lista, 0, 2).pagina).toBe(1);
    expect(paginar([], 1, 12)).toEqual({ items: [], total: 0, pagina: 1, tamano: 12 });
  });

  it('estadoStock: 0 agotado, 3 y 5 pocas, 6 disponible (CA-4.1)', () => {
    expect([0, 3, 5, 6].map(estadoStock)).toEqual(['agotado', 'pocas', 'pocas', 'disponible']);
  });

  it('especificacionesOrdenadas respeta Atributo.orden y omite claves vacías, pero no `false`', () => {
    const attr = (clave: string, orden: number): Atributo => ({ id: orden, categoria_id: 1, clave, clave_i18n: clave, tipo: 'texto', unidad: null, valores_permitidos: null, filtrable: false, usa_compatibilidad: false, orden });
    const filas = especificacionesOrdenadas(
      { especificaciones: { c: 'z', a: 'x', b: '', d: false, e: [] } },
      [attr('a', 2), attr('b', 1), attr('c', 3), attr('d', 4), attr('e', 5), attr('f', 6)],
    );
    expect(filas.map((f) => f.atributo.clave)).toEqual(['a', 'c', 'd']);
  });
});
