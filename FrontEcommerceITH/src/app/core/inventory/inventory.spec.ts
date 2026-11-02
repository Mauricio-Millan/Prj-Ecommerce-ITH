import { LineaInventario, aplicarLote, diferencia, sumarEscaneo } from './inventory.logic';

const productos = [
  { sku: 'A', stock: 5 },
  { sku: 'B', stock: 0 },
];
const aplicar = (lineas: LineaInventario[], modo: 'ingreso' | 'conteo', motivo: 'merma' | null = null) =>
  aplicarLote(productos, lineas, modo, motivo, 'admin@x', new Date('2026-11-02T10:00:00Z'), 'L1');

describe('sumarEscaneo (spec 015, CA-1.3)', () => {
  it('crea la línea con 1 y el escaneo repetido suma uno', () => {
    let l = sumarEscaneo([], 'A');
    expect(l).toEqual([{ sku: 'A', cantidad: 1 }]);
    l = sumarEscaneo(sumarEscaneo(l, 'B'), 'A');
    expect(l).toEqual([{ sku: 'A', cantidad: 2 }, { sku: 'B', cantidad: 1 }]);
  });
});

describe('aplicarLote', () => {
  it('ingreso: suma al stock y registra un movimiento por línea', () => {
    const r = aplicar([{ sku: 'A', cantidad: 3 }, { sku: 'B', cantidad: 2 }], 'ingreso');
    expect(r.ok).toBeTrue();
    if (r.ok) {
      expect(r.stockPorSku).toEqual({ A: 8, B: 2 });
      expect(r.unidades).toBe(5);
      expect(r.movimientos[0]).toEqual(jasmine.objectContaining({ tipo: 'ingreso', cantidad: 3, stock_antes: 5, stock_despues: 8, motivo: null }));
    }
  });

  it('ingreso: una cantidad cero, negativa o decimal se rechaza y no cambia nada', () => {
    for (const cantidad of [0, -1, 1.5]) expect(aplicar([{ sku: 'A', cantidad }], 'ingreso')).toEqual({ ok: false, error: 'CANTIDAD_INVALIDA', sku: 'A' });
  });

  it('un producto desconocido invalida TODO el lote (todo o nada)', () => {
    expect(aplicar([{ sku: 'A', cantidad: 1 }, { sku: 'Z', cantidad: 1 }], 'ingreso')).toEqual({ ok: false, error: 'PRODUCTO_NO_ENCONTRADO', sku: 'Z' });
  });

  it('conteo: deja el stock igual a lo contado y omite las líneas sin diferencia', () => {
    const r = aplicar([{ sku: 'A', cantidad: 3 }, { sku: 'B', cantidad: 0 }], 'conteo', 'merma');
    expect(r.ok).toBeTrue();
    if (r.ok) {
      expect(r.stockPorSku).toEqual({ A: 3 });
      expect(r.movimientos.length).toBe(1);
      expect(r.movimientos[0]).toEqual(jasmine.objectContaining({ tipo: 'ajuste', cantidad: -2, motivo: 'merma' }));
    }
  });

  it('conteo: con diferencias exige motivo; sin diferencias no', () => {
    expect(aplicar([{ sku: 'A', cantidad: 4 }], 'conteo')).toEqual({ ok: false, error: 'MOTIVO_REQUERIDO', sku: 'A' });
    expect(aplicar([{ sku: 'A', cantidad: 5 }], 'conteo').ok).toBeTrue();
  });

  it('conteo: un contado negativo se rechaza (el stock nunca baja de 0)', () => {
    expect(aplicar([{ sku: 'A', cantidad: -1 }], 'conteo', 'merma')).toEqual({ ok: false, error: 'CANTIDAD_INVALIDA', sku: 'A' });
  });

  it('sin líneas no hay lote', () => {
    expect(aplicar([], 'ingreso')).toEqual({ ok: false, error: 'SIN_LINEAS' });
  });
});

describe('diferencia (CA-2.2)', () => {
  it('contado menos sistema, con signo', () => {
    expect(diferencia(7, 5)).toBe(2);
    expect(diferencia(4, 5)).toBe(-1);
    expect(diferencia(5, 5)).toBe(0);
  });
});
