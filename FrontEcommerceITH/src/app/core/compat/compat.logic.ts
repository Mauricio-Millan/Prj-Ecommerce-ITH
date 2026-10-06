import { Atributo, Categoria, Equipo, Producto, ProductoCompatibilidad, ValorEspecificacion } from '../catalog/catalog.models';
import { cumple } from './reglas';

export type Estado = 'compatible' | 'incompatible' | 'sin_datos' | 'no_aplica';

export interface AtributoComparado {
  clave: string;
  equipo: string;
  producto: string;
  cumple: boolean;
}

export interface ResultadoCompat {
  estado: Estado;
  nivel: 'lista' | 'atributos' | null;
  /** ✗ por lista: los modelos para los que sí es el producto ("Este producto es para: …"). */
  paraEquipos?: string[];
  /** Por atributos: lo que se comparó, para explicarlo en simple (CA-2.3). */
  atributos?: AtributoComparado[];
}

export interface ContextoCompat {
  categorias: readonly Categoria[];
  atributos: readonly Atributo[];
  equipos: readonly Equipo[];
  compatibilidades: readonly ProductoCompatibilidad[];
  marcas: readonly { id: number; nombre: string }[];
}

const NO_APLICA: ResultadoCompat = { estado: 'no_aplica', nivel: null };
const RAICES = ['componentes-laptop', 'repuestos-laptop'];

export function slugDe(producto: Producto, categorias: readonly Categoria[]): string {
  return categorias.find((c) => c.id === producto.categoria_id)?.slug ?? '';
}

/** Spec § 4: solo laptops y sus piezas (Componentes de laptop, Repuestos de laptop y paneles de laptop). */
export function aplica(producto: Producto, categorias: readonly Categoria[]): boolean {
  const sub = categorias.find((c) => c.id === producto.categoria_id);
  if (!sub) return false;
  const raiz = categorias.find((c) => c.id === sub.padre_id) ?? sub;
  return RAICES.includes(raiz.slug) || sub.slug === 'paneles-laptop';
}

const texto = (v: ValorEspecificacion | undefined) => (Array.isArray(v) ? v.join(', ') : String(v));

/** Orden de la spec § 4: la lista manda sobre los atributos; sin ninguno de los dos → "sin confirmar". Nunca se lee la descripción. */
export function evaluar(producto: Producto, equipo: Equipo, ctx: ContextoCompat): ResultadoCompat {
  if (!aplica(producto, ctx.categorias)) return NO_APLICA;

  // 1. Lista (nivel 3)
  const lista = ctx.compatibilidades.filter((c) => c.producto_id === producto.id);
  if (lista.length) {
    if (lista.some((c) => c.equipo_id === equipo.id)) return { estado: 'compatible', nivel: 'lista' };
    const paraEquipos = lista
      .map((c) => ctx.equipos.find((e) => e.id === c.equipo_id))
      .filter((e): e is Equipo => !!e)
      .map((e) => e.modelo);
    return { estado: 'incompatible', nivel: 'lista', paraEquipos };
  }

  // 2. Atributos (nivel 2): los ⚙ de la subcategoría que el equipo también declara.
  const atributos = ctx.atributos
    .filter((a) => a.categoria_id === producto.categoria_id && a.usa_compatibilidad && a.clave in equipo.especificaciones)
    .flatMap<AtributoComparado>((a) => {
      const delEquipo = equipo.especificaciones[a.clave];
      const delProducto = producto.especificaciones[a.clave];
      const ok = cumple('igual', delEquipo, delProducto);
      return ok === null ? [] : [{ clave: a.clave, equipo: texto(delEquipo), producto: texto(delProducto), cumple: ok }];
    });
  if (atributos.length) return { estado: atributos.every((a) => a.cumple) ? 'compatible' : 'incompatible', nivel: 'atributos', atributos };

  // 3. Sin datos
  return { estado: 'sin_datos', nivel: null };
}
