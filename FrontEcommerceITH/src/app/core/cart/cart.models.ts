import { Producto } from '../catalog/catalog.models';

/** Lo único que guarda el carrito: sku y cantidad. Precios, nombres y stock salen siempre del catálogo (CA-4.5). */
export interface LineaCarrito {
  sku: string;
  cantidad: number;
}

export interface ResultadoSumar {
  items: LineaCarrito[];
  /** Cuántas unidades se agregaron de verdad. */
  agregadas: number;
  /** `true` si no entró todo lo pedido porque se llegó al stock (CA-2.4). */
  limitado: boolean;
}

/** Lo necesario para deshacer una eliminación: la línea y su posición (CA-3.2). */
export interface Quitada {
  linea: LineaCarrito;
  indice: number;
}

export type AvisoCarrito = { tipo: 'quitado'; sku: string; nombre: string } | { tipo: 'ajustado'; sku: string; disponible: number };

export type EstadoLinea = 'ok' | 'ajustado' | 'agotado';

/** Todo el dinero va en céntimos enteros (`core/currency/money.ts`). `precioPen*` es `null` si no hay tipo de cambio. */
export interface LineaDetalle {
  linea: LineaCarrito;
  producto: Producto;
  estado: EstadoLinea;
  precioPenCentimos: number | null;
  subtotalPenCentimos: number | null;
  precioUsdCentimos: number;
  subtotalUsdCentimos: number;
}

export type MotivoBloqueo = 'agotados' | 'sin-tc' | 'vacio' | null;

export interface ResumenCarrito {
  /** Unidades que se pagarán (sin contar las agotadas). */
  unidades: number;
  totalPenCentimos: number;
  totalUsdCentimos: number;
  agotados: number;
  puedePagar: boolean;
  motivo: MotivoBloqueo;
}
