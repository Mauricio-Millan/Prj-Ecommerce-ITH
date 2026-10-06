/** Catálogo de zonas (spec 012 § 4). Una zona nueva se agrega primero a la spec y luego aquí. */
export const ZONAS = [
  'buscador', 'categorias', 'carrito', 'selector-idioma', 'selector-moneda', 'filtros', 'resultados', 'tarjeta-producto',
  'precio', 'compatibilidad', 'ficha-tecnica', 'cta-principal', 'formulario-cuenta', 'lista-pedidos', 'linea-carrito',
  'resumen-pedido', 'formulario-checkout', 'armador-paso', 'armador-conflicto',
] as const;

/** Catálogo de modales (spec 012 § 4.1). Las advertencias (incompatible, conflictos del armador) no usan modal. */
export const MODALES = ['menu-movil', 'confirmar-eliminar', 'filtros-movil', 'terminos', 'mi-equipo'] as const;

export type ZonaId = (typeof ZONAS)[number];
export type ModalId = (typeof MODALES)[number];

export const esZonaCatalogada = (nombre: string): nombre is ZonaId => (ZONAS as readonly string[]).includes(nombre);
export const esModalCatalogado = (nombre: string): nombre is ModalId => (MODALES as readonly string[]).includes(nombre);
