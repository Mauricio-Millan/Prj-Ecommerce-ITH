import { Producto } from '../catalog/catalog.models';
import { EstadoPedido, Pedido } from './orders.models';

/** Pasos válidos desde cada estado (spec 010, CA-3.5): nunca se retrocede. */
export function siguientesEstados(estado: EstadoPedido): EstadoPedido[] {
  switch (estado) {
    case 'pagado':
      return ['enviado', 'cancelado'];
    case 'enviado':
      return ['entregado'];
    default:
      return [];
  }
}

/** El pedido con el nuevo estado y su entrada en el historial; `null` si el paso no es válido. Cancelar exige motivo (CA-3.4). */
export function aplicarTransicion(pedido: Pedido, nuevo: EstadoPedido, ahora: Date, motivo?: string): Pedido | null {
  if (!siguientesEstados(pedido.estado).includes(nuevo)) return null;
  if (nuevo === 'cancelado' && !motivo?.trim()) return null;
  const entrada = { estado: nuevo, fecha: ahora.toISOString(), ...(nuevo === 'cancelado' && { motivo: motivo!.trim() }) };
  return { ...pedido, estado: nuevo, historial_estados: [...pedido.historial_estados, entrada] };
}

/**
 * Stock nuevo de cada SKU del pedido al cancelarlo: el pago aprobado ya lo había descontado (006, CA-5.1).
 * Los SKU que ya no existen en el catálogo se devuelven aparte para avisarlo y no se reponen.
 */
export function stockTrasCancelar(pedido: Pedido, productos: readonly Pick<Producto, 'sku' | 'stock'>[]): { stockPorSku: Record<string, number>; sinProducto: string[] } {
  const stockPorSku: Record<string, number> = {};
  const sinProducto: string[] = [];
  for (const item of pedido.items) {
    const p = productos.find((x) => x.sku === item.sku);
    if (!p) sinProducto.push(item.sku);
    else stockPorSku[item.sku] = (stockPorSku[item.sku] ?? p.stock) + item.cantidad;
  }
  return { stockPorSku, sinProducto };
}

export type FiltroEstadoPedido = EstadoPedido | 'por_enviar' | 'todos';

/** CA-1.2: por estado y por código o nombre del cliente (comprobante o destinatario). Los más recientes primero. */
export function filtrarPedidos(pedidos: readonly Pedido[], estado: FiltroEstadoPedido, q: string): Pedido[] {
  const texto = q.trim().toLowerCase();
  return pedidos
    .filter((p) => (estado === 'todos' ? true : estado === 'por_enviar' ? p.estado === 'pagado' : p.estado === estado))
    .filter((p) => !texto || [p.codigo, p.comprobante_nombre, p.envio.destinatario].some((x) => x.toLowerCase().includes(texto)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
