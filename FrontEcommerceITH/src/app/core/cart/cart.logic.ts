import { Producto } from '../catalog/catalog.models';
import { aCentimos, precioPenCentimos, subtotalCentimos } from '../currency/money';
import { AvisoCarrito, LineaCarrito, LineaDetalle, Quitada, ResultadoSumar, ResumenCarrito } from './cart.models';

/** Suma a la línea existente (o crea una) sin pasar del stock. No modifica el arreglo original. */
export function sumar(items: readonly LineaCarrito[], sku: string, cantidad: number, stock: number): ResultadoSumar {
  const existente = items.find((l) => l.sku === sku);
  const actual = existente?.cantidad ?? 0;
  const nueva = Math.min(actual + Math.max(0, cantidad), Math.max(0, stock));
  const agregadas = Math.max(0, nueva - actual);
  const limitado = agregadas < cantidad;
  if (agregadas === 0) return { items: [...items], agregadas, limitado };
  return {
    items: existente ? items.map((l) => (l.sku === sku ? { ...l, cantidad: nueva } : l)) : [...items, { sku, cantidad: nueva }],
    agregadas,
    limitado,
  };
}

/** Cantidad entre 1 y el stock: `−` en 1 no quita la línea, para eso está "Eliminar" (CA-2.3, H5). */
export function fijarCantidad(items: readonly LineaCarrito[], sku: string, n: number, stock: number): LineaCarrito[] {
  const cantidad = Math.max(1, Math.min(Math.floor(n) || 1, stock));
  return items.map((l) => (l.sku === sku ? { ...l, cantidad } : l));
}

/** Quita la línea y devuelve lo necesario para deshacer (CA-3.1). */
export function quitar(items: readonly LineaCarrito[], sku: string): { items: LineaCarrito[]; quitada: Quitada | null } {
  const indice = items.findIndex((l) => l.sku === sku);
  if (indice < 0) return { items: [...items], quitada: null };
  return { items: items.filter((_, i) => i !== indice), quitada: { linea: items[indice], indice } };
}

/**
 * Reinserta en la posición original (CA-3.2). Si la línea ya volvió a existir, suma las cantidades.
 * ponytail: con dos eliminaciones seguidas el índice es el que tenía al quitarse; deshacer en otro orden puede dejar la línea una posición
 * distinta, pero cada aviso recupera su producto (CA-3.3).
 */
export function restaurar(items: readonly LineaCarrito[], { linea, indice }: Quitada): LineaCarrito[] {
  if (items.some((l) => l.sku === linea.sku)) return items.map((l) => (l.sku === linea.sku ? { ...l, cantidad: l.cantidad + linea.cantidad } : l));
  const copia = [...items];
  copia.splice(Math.min(indice, copia.length), 0, linea);
  return copia;
}

/**
 * Pone el carrito al día con el catálogo (HU-4): quita lo que ya no existe o está inactivo, ajusta lo que supera el stock y MANTIENE
 * las líneas agotadas para que el usuario las vea y las elimine (CA-4.1, 4.2, 4.4).
 */
export function reconciliar(items: readonly LineaCarrito[], catalogo: readonly Producto[]): { items: LineaCarrito[]; avisos: AvisoCarrito[] } {
  const avisos: AvisoCarrito[] = [];
  const resultado: LineaCarrito[] = [];
  for (const l of items) {
    const p = catalogo.find((x) => x.sku === l.sku);
    if (!p || !p.activo) {
      avisos.push({ tipo: 'quitado', sku: l.sku, nombre: p?.nombre ?? l.sku });
    } else if (p.stock > 0 && l.cantidad > p.stock) {
      avisos.push({ tipo: 'ajustado', sku: l.sku, disponible: p.stock });
      resultado.push({ ...l, cantidad: p.stock });
    } else {
      resultado.push(l);
    }
  }
  return { items: resultado, avisos };
}

/** Cada línea con sus montos en céntimos: la base de lo que se ve y de lo que se cobra (CA-1.3). Sin tipo de cambio, el soles es `null`. */
export function detallar(items: readonly LineaCarrito[], catalogo: readonly Producto[], tc: number | null, ajustadas: ReadonlySet<string> = new Set()): LineaDetalle[] {
  return items.flatMap<LineaDetalle>((linea) => {
    const producto = catalogo.find((p) => p.sku === linea.sku);
    if (!producto) return [];
    const unitario = tc ? precioPenCentimos(producto.precio_usd, tc) : null;
    const unitarioUsd = aCentimos(producto.precio_usd);
    return [
      {
        linea,
        producto,
        estado: producto.stock <= 0 ? 'agotado' : ajustadas.has(linea.sku) ? 'ajustado' : 'ok',
        precioPenCentimos: unitario,
        subtotalPenCentimos: unitario === null ? null : subtotalCentimos(unitario, linea.cantidad),
        precioUsdCentimos: unitarioUsd,
        subtotalUsdCentimos: subtotalCentimos(unitarioUsd, linea.cantidad),
      },
    ];
  });
}

/** El total suma solo las líneas NO agotadas (CA-4.2); en soles es la suma de los subtotales ya redondeados (CA-1.3). */
export function resumen(lineas: readonly LineaDetalle[]): ResumenCarrito {
  const vigentes = lineas.filter((l) => l.estado !== 'agotado');
  const agotados = lineas.length - vigentes.length;
  const hayTc = lineas.every((l) => l.precioPenCentimos !== null);
  const motivo = lineas.length === 0 ? 'vacio' : agotados > 0 ? 'agotados' : !hayTc ? 'sin-tc' : null;
  return {
    unidades: vigentes.reduce((s, l) => s + l.linea.cantidad, 0),
    totalPenCentimos: vigentes.reduce((s, l) => s + (l.subtotalPenCentimos ?? 0), 0),
    totalUsdCentimos: vigentes.reduce((s, l) => s + l.subtotalUsdCentimos, 0),
    agotados,
    puedePagar: motivo === null,
    motivo,
  };
}

/** Al iniciar sesión (CA-5.2): primero las líneas de la cuenta y luego las del carrito anónimo, sumando sin pasar del stock. */
export function combinar(anonimo: readonly LineaCarrito[], cuenta: readonly LineaCarrito[], catalogo: readonly Producto[]): { items: LineaCarrito[]; agregadas: number } {
  let items: LineaCarrito[] = [...cuenta];
  let agregadas = 0;
  for (const l of anonimo) {
    const p = catalogo.find((x) => x.sku === l.sku);
    if (!p || !p.activo) continue;
    const r = sumar(items, l.sku, l.cantidad, p.stock);
    items = r.items;
    agregadas += r.agregadas;
  }
  return { items, agregadas };
}
