export type MetodoPago = 'tarjeta' | 'yape';
/** Lo que responde la pasarela simulada. `sin_stock` lo registra la tienda ANTES de cobrar. */
export type ResultadoCobro = 'aprobado' | 'rechazado' | 'sin_respuesta';
export type ResultadoPagoRegistrado = ResultadoCobro | 'sin_stock';
/** enviado y entregado los pone la administración de pedidos (spec 010). */
export type EstadoPedido = 'pendiente_pago' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';

/** Copia fija de la dirección al momento de comprar. */
export interface Envio {
  ubigeo_id: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  referencia: string;
  destinatario: string;
  telefono: string;
}

/** Copia fija de lo comprado: el pedido NO cambia aunque después cambien el precio o el nombre (spec 006 § 1.3). Montos en céntimos enteros. */
export interface ItemPedido {
  sku: string;
  nombre_producto: string;
  imagen: string;
  precio_unitario_usd: number;
  precio_unitario_pen_centimos: number;
  cantidad: number;
  subtotal_pen_centimos: number;
}

/** De un pago se guarda el medio y el resultado; NUNCA tarjeta, celular de Yape ni código (CA-4.6). */
export interface Pago {
  metodo: MetodoPago;
  resultado: ResultadoPagoRegistrado;
  monto_pen_centimos: number;
  referencia: string | null;
  fecha: string;
}

export interface Pedido {
  codigo: string;
  usuarioId: string;
  estado: EstadoPedido;
  /** Identifica contenido y precios: si cambia, cambió algo que el usuario aprobó (CA-3.4, 5.5). */
  firma: string;
  tipo_cambio: number;
  igv_tasa: number;
  total_pen_centimos: number;
  op_gravada_pen_centimos: number;
  igv_pen_centimos: number;
  total_usd_centimos: number;
  comprobante: 'boleta';
  comprobante_nombre: string;
  comprobante_dni: string;
  envio: Envio;
  items: ItemPedido[];
  pagos: Pago[];
  /** La spec 007 lo muestra como seguimiento. */
  historial_estados: { estado: EstadoPedido; fecha: string }[];
  created_at: string;
}

export interface Faltante {
  sku: string;
  nombre: string;
  pedido: number;
  disponible: number;
}

export type ResultadoPago =
  | { tipo: 'aprobado'; pedido: Pedido }
  | { tipo: 'rechazado' | 'sin_respuesta'; pedido: Pedido }
  | { tipo: 'SIN_STOCK'; faltantes: Faltante[] }
  | { tipo: 'TOTAL_CAMBIO'; antes: number; despues: number }
  | { tipo: 'NO_ENCONTRADO' };
