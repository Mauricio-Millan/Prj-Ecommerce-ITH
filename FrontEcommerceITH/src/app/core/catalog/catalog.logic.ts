import { Atributo, EstadoStock, Orden, Pagina, Producto, ValorEspecificacion } from './catalog.models';

/** Con 5 unidades o menos se avisa "¡Quedan N!" (CA-4.1). */
export const UMBRAL_POCAS = 5;

export function estadoStock(stock: number): EstadoStock {
  if (stock <= 0) return 'agotado';
  return stock <= UMBRAL_POCAS ? 'pocas' : 'disponible';
}

/**
 * Ordena sin modificar la lista original. `destacados`: los agotados al final (CA-4.3), luego los destacados.
 * El orden por precio usa USD, así que da lo mismo en cualquier moneda (CA-3.5). Los empates se desempatan por id.
 */
export function ordenar(productos: readonly Producto[], orden: Orden): Producto[] {
  const porId = (a: Producto, b: Producto) => a.id - b.id;
  const copia = [...productos];
  switch (orden) {
    case 'relevancia':
      return copia; // ya vienen en el orden del motor
    case 'precio-asc':
      return copia.sort((a, b) => a.precio_usd - b.precio_usd || porId(a, b));
    case 'precio-desc':
      return copia.sort((a, b) => b.precio_usd - a.precio_usd || porId(a, b));
    case 'nuevos':
      return copia.sort((a, b) => b.created_at.localeCompare(a.created_at) || porId(a, b));
    default:
      return copia.sort(
        (a, b) => Number(a.stock <= 0) - Number(b.stock <= 0) || Number(b.destacado) - Number(a.destacado) || porId(a, b),
      );
  }
}

/** La página se ajusta al rango válido: `?pagina=99` o `?pagina=0` no dejan la pantalla vacía (H9). */
export function paginar<T>(lista: readonly T[], pagina: number, tamano: number): Pagina<T> {
  const total = lista.length;
  const ultima = Math.max(1, Math.ceil(total / tamano));
  const actual = Math.min(Math.max(1, Math.trunc(pagina) || 1), ultima);
  return { items: lista.slice((actual - 1) * tamano, actual * tamano), total, pagina: actual, tamano };
}

export interface FilaEspecificacion {
  atributo: Atributo;
  valor: ValorEspecificacion;
}

const vacio = (v: ValorEspecificacion | undefined) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Las especificaciones en el orden del atributo (patrón F: lo importante primero). Omite las claves sin valor; `false` sí es un valor. */
export function especificacionesOrdenadas(producto: Pick<Producto, 'especificaciones'>, atributos: readonly Atributo[]): FilaEspecificacion[] {
  return [...atributos]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((atributo) => {
      const valor = producto.especificaciones[atributo.clave];
      return vacio(valor) ? [] : [{ atributo, valor }];
    });
}
