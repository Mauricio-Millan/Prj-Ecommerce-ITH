import { Producto } from '../catalog/catalog.models';

export type ModoInventario = 'ingreso' | 'conteo';
export type MotivoAjuste = 'conteo_fisico' | 'merma' | 'devolucion' | 'otro';
export const MOTIVOS: readonly MotivoAjuste[] = ['conteo_fisico', 'merma', 'devolucion', 'otro'];

/** En ingreso `cantidad` son las unidades que llegaron; en conteo, las unidades CONTADAS (el stock final). */
export interface LineaInventario {
  sku: string;
  cantidad: number;
}

export interface Movimiento {
  id: string;
  lote_id: string;
  sku: string;
  tipo: 'ingreso' | 'ajuste';
  /** Con signo: negativo si el ajuste bajó el stock. */
  cantidad: number;
  stock_antes: number;
  stock_despues: number;
  motivo: MotivoAjuste | null;
  usuario: string;
  creado_en: string;
}

export type ErrorLote = 'CANTIDAD_INVALIDA' | 'PRODUCTO_NO_ENCONTRADO' | 'MOTIVO_REQUERIDO' | 'STOCK_NEGATIVO' | 'SIN_LINEAS';

export type ResultadoLote =
  | { ok: true; stockPorSku: Record<string, number>; movimientos: Movimiento[]; unidades: number }
  | { ok: false; error: ErrorLote; sku?: string };

/** Contado menos sistema (spec 015, CA-2.2): positivo = sobran, negativo = faltan. */
export const diferencia = (contado: number, sistema: number): number => contado - sistema;

/** Suma una unidad a la línea del producto, o la crea con 1 (CA-1.3, 2.1): el escaneo repetido suma. */
export function sumarEscaneo(lineas: readonly LineaInventario[], sku: string): LineaInventario[] {
  return lineas.some((l) => l.sku === sku) ? lineas.map((l) => (l.sku === sku ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...lineas, { sku, cantidad: 1 }];
}

/**
 * Valida y calcula un lote completo SIN modificar nada: o todo es válido o no hay cambios (CA-1.6, "todo junto o nada").
 * Ingreso: suma. Conteo: el stock queda igual a lo contado; las líneas sin diferencia no generan movimiento y exigen motivo las que sí.
 * El stock nunca queda por debajo de 0 (CA-2.4). En la Fase 2 lo hace `registrar_movimientos_stock` dentro de una transacción.
 */
export function aplicarLote(
  productos: readonly Pick<Producto, 'sku' | 'stock'>[],
  lineas: readonly LineaInventario[],
  modo: ModoInventario,
  motivo: MotivoAjuste | null,
  usuario: string,
  ahora: Date,
  loteId: string,
): ResultadoLote {
  if (!lineas.length) return { ok: false, error: 'SIN_LINEAS' };
  const stock = new Map(productos.map((p) => [p.sku, p.stock]));
  const stockPorSku: Record<string, number> = {};
  const movimientos: Movimiento[] = [];

  for (const [i, l] of lineas.entries()) {
    const antes = stock.get(l.sku);
    if (antes === undefined) return { ok: false, error: 'PRODUCTO_NO_ENCONTRADO', sku: l.sku };
    const valida = Number.isInteger(l.cantidad) && (modo === 'conteo' ? l.cantidad >= 0 : l.cantidad > 0);
    if (!valida) return { ok: false, error: 'CANTIDAD_INVALIDA', sku: l.sku };

    const delta = modo === 'ingreso' ? l.cantidad : diferencia(l.cantidad, antes);
    if (delta === 0) continue;
    if (modo === 'conteo' && !motivo) return { ok: false, error: 'MOTIVO_REQUERIDO', sku: l.sku };
    const despues = antes + delta;
    if (despues < 0) return { ok: false, error: 'STOCK_NEGATIVO', sku: l.sku };

    stockPorSku[l.sku] = despues;
    movimientos.push({
      id: `${loteId}-${i + 1}`,
      lote_id: loteId,
      sku: l.sku,
      tipo: modo === 'ingreso' ? 'ingreso' : 'ajuste',
      cantidad: delta,
      stock_antes: antes,
      stock_despues: despues,
      motivo: modo === 'conteo' ? motivo : null,
      usuario,
      creado_en: ahora.toISOString(),
    });
  }
  return { ok: true, stockPorSku, movimientos, unidades: movimientos.reduce((s, m) => s + Math.abs(m.cantidad), 0) };
}
