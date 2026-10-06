import { LineaDetalle } from '../cart/cart.models';
import { Producto } from '../catalog/catalog.models';
import { IGV_TASA, desglosarIgv } from '../currency/igv';
import { Envio, EstadoPedido, Faltante, Pedido } from './orders.models';

/** `sku:cantidad:precioPenCentimos` de cada línea + el tipo de cambio. Si cambia algo, cambia la firma (CA-3.4, 5.5). */
export function firma(lineas: readonly LineaDetalle[], tc: number): string {
  return lineas.map((l) => `${l.linea.sku}:${l.linea.cantidad}:${l.precioPenCentimos}`).join('|') + `@${tc}`;
}

export interface DatosComprobante {
  nombres: string;
  apellidos: string;
  dni: string;
}

/** Copia fija de precios, el total (= Σ subtotales, ya redondeados por unidad), el IGV desglosado, el comprobante a nombre del titular y el envío. */
export function construirPedido(
  lineas: readonly LineaDetalle[],
  tc: number,
  usuarioId: string,
  titular: DatosComprobante,
  envio: Envio,
  codigo: string,
  fecha: string,
): Pedido {
  const items = lineas.map((l) => ({
    sku: l.producto.sku,
    nombre_producto: l.producto.nombre,
    imagen: l.producto.imagenes[0]?.url ?? '',
    precio_unitario_usd: l.producto.precio_usd,
    precio_unitario_pen_centimos: l.precioPenCentimos!,
    cantidad: l.linea.cantidad,
    subtotal_pen_centimos: l.subtotalPenCentimos!,
  }));
  const total = items.reduce((s, i) => s + i.subtotal_pen_centimos, 0);
  const { opGravada, igv } = desglosarIgv(total);
  return {
    codigo,
    usuarioId,
    estado: 'pendiente_pago',
    firma: firma(lineas, tc),
    tipo_cambio: tc,
    igv_tasa: IGV_TASA,
    total_pen_centimos: total,
    op_gravada_pen_centimos: opGravada,
    igv_pen_centimos: igv,
    total_usd_centimos: lineas.reduce((s, l) => s + l.subtotalUsdCentimos, 0),
    comprobante: 'boleta',
    comprobante_nombre: `${titular.nombres} ${titular.apellidos}`.trim(),
    comprobante_dni: titular.dni,
    envio,
    items,
    pagos: [],
    historial_estados: [{ estado: 'pendiente_pago', fecha }],
    created_at: fecha,
  };
}

/** Las líneas sin stock suficiente: "«Mouse»: pediste 3, quedan 1" (CA-5.4). */
export function faltantes(pedido: Pedido, catalogo: readonly Producto[]): Faltante[] {
  return pedido.items.flatMap((i) => {
    const disponible = catalogo.find((p) => p.sku === i.sku)?.stock ?? 0;
    return disponible < i.cantidad ? [{ sku: i.sku, nombre: i.nombre_producto, pedido: i.cantidad, disponible }] : [];
  });
}

// ───────────── Mis pedidos (spec 007) ─────────────

const fechaDe = (p: Pedido, estado: EstadoPedido) => p.historial_estados.find((h) => h.estado === estado)?.fecha ?? null;

/**
 * Los pedidos del cliente que SE COBRARON, del más reciente al más antiguo (CA-1.1, 1.6): los que tienen `pagado` en el historial.
 * Así se excluyen los intentos que nunca se pagaron (pendientes o cancelados por la 006) pero se incluyen los cancelados por la tienda
 * DESPUÉS de pagar.
 */
export const visibles = (pedidos: readonly Pedido[], usuarioId: string): Pedido[] =>
  pedidos
    .filter((p) => p.usuarioId === usuarioId && fechaDe(p, 'pagado') !== null)
    .sort((a, b) => fechaDe(b, 'pagado')!.localeCompare(fechaDe(a, 'pagado')!));

/** El último estado del historial. */
export const estadoActual = (p: Pedido): EstadoPedido => p.historial_estados[p.historial_estados.length - 1]?.estado ?? p.estado;

export interface PasoSeguimiento {
  estado: 'pagado' | 'enviado' | 'entregado' | 'cancelado';
  /** `null` = todavía no se alcanzó. */
  fecha: string | null;
  /** El último paso alcanzado: lleva `aria-current="step"`. */
  actual: boolean;
}

/** Pagado → Enviado → Entregado con la fecha de cada paso; si la tienda canceló el pedido, el seguimiento termina en "Cancelado" (CA-3.2). */
export function seguimiento(p: Pedido): PasoSeguimiento[] {
  const actual = estadoActual(p);
  const orden: PasoSeguimiento['estado'][] = actual === 'cancelado' ? ['pagado', 'cancelado'] : ['pagado', 'enviado', 'entregado'];
  const alcanzados = orden.filter((e) => fechaDe(p, e) !== null);
  const ultimo = alcanzados[alcanzados.length - 1];
  return orden.map((estado) => ({ estado, fecha: fechaDe(p, estado), actual: estado === ultimo }));
}

/** Catálogo nuevo con el stock descontado; no modifica el original (CA-5.1). */
export function descontar(catalogo: readonly Producto[], pedido: Pedido): Producto[] {
  return catalogo.map((p) => {
    const item = pedido.items.find((i) => i.sku === p.sku);
    return item ? { ...p, stock: p.stock - item.cantidad } : p;
  });
}
