import { Atributo, Categoria, Condicion, Marca, Producto, ValorEspecificacion } from '../catalog/catalog.models';
import { UMBRAL_POCAS } from '../catalog/catalog.logic';
import { eanValido } from '../scan/scan.logic';
import { compactar, normalizar } from '../search/normalize';

/** Lo que escribe la persona: los números llegan como texto desde los campos y se validan antes de convertirlos. */
export interface BorradorProducto {
  sku: string;
  nombre: string;
  categoria_id: number | null;
  marca_id: number | null;
  modelo: string;
  numero_parte: string;
  codigo_barras: string;
  condicion: Condicion;
  garantia_meses: string;
  descripcion: string;
  precio_usd: string;
  stock: string;
  imagenes: { url: string; alt: string }[];
  /** Por clave de atributo. Texto, número como texto, lista o booleano. */
  especificaciones: Record<string, string | boolean>;
  destacado: boolean;
  activo: boolean;
}

export interface ContextoValidacion {
  productos: readonly Producto[];
  categorias: readonly Categoria[];
  atributos: readonly Atributo[];
  marcas: readonly Marca[];
  /** SKU del producto que se edita (no cuenta como duplicado de sí mismo); `null` si es nuevo. */
  skuOriginal: string | null;
}

/** Clave de error → clave de traducción `adminProduct.error.<clave>`. La clave del campo es la del mapa. */
export type ErroresProducto = Record<string, string>;

export const MIN_DESCRIPCION = 20;
const SKU_VALIDO = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export const atributosDe = (atributos: readonly Atributo[], categoriaId: number | null): Atributo[] =>
  categoriaId === null ? [] : atributos.filter((a) => a.categoria_id === categoriaId).sort((x, y) => x.orden - y.orden);

const vacio = (v: string | boolean | undefined) => v === undefined || (typeof v === 'string' && v.trim() === '');

/** Todo o nada (spec 009, CA-2.3): devuelve los errores por campo; mapa vacío = se puede guardar. */
export function validarProducto(b: BorradorProducto, ctx: ContextoValidacion): ErroresProducto {
  const e: ErroresProducto = {};
  const sku = b.sku.trim();

  if (!sku) e['sku'] = 'requerido';
  else if (!SKU_VALIDO.test(sku)) e['sku'] = 'sku-formato';
  else if (ctx.skuOriginal === null && ctx.productos.some((p) => p.sku === sku)) e['sku'] = 'sku-duplicado';

  if (b.nombre.trim().length < 5) e['nombre'] = 'nombre-corto';

  const categoria = ctx.categorias.find((c) => c.id === b.categoria_id);
  if (!categoria || categoria.padre_id === null) e['categoria'] = 'categoria';

  if (!ctx.marcas.some((m) => m.id === b.marca_id)) e['marca'] = 'marca';
  if (!b.modelo.trim()) e['modelo'] = 'requerido';
  if (b.descripcion.trim().length < MIN_DESCRIPCION) e['descripcion'] = 'descripcion-corta';

  if (!/^\d+(\.\d{1,2})?$/.test(b.precio_usd.trim()) || Number(b.precio_usd) <= 0) e['precio'] = 'precio';
  if (!/^\d+$/.test(b.stock.trim())) e['stock'] = 'entero';
  if (!/^\d+$/.test(b.garantia_meses.trim())) e['garantia'] = 'entero';

  const ean = b.codigo_barras.trim();
  if (ean) {
    if (!eanValido(ean)) e['codigo_barras'] = 'ean-invalido';
    else if (ctx.productos.some((p) => p.codigo_barras === ean && p.sku !== (ctx.skuOriginal ?? sku))) e['codigo_barras'] = 'ean-duplicado';
  }

  if (!b.imagenes.length) e['imagenes'] = 'imagen-requerida';
  b.imagenes.forEach((img, i) => {
    if (!img.url.trim()) e[`img.${i}.url`] = 'requerido';
    if (!img.alt.trim()) e[`img.${i}.alt`] = 'alt-requerido';
  });

  for (const a of atributosDe(ctx.atributos, b.categoria_id)) {
    const v = b.especificaciones[a.clave];
    const campo = `esp.${a.clave}`;
    if (a.tipo === 'booleano') continue;
    if (vacio(v)) {
      if (a.usa_compatibilidad) e[campo] = 'esp-requerida';
    } else if (a.tipo === 'numero' && !Number.isFinite(Number(v))) e[campo] = 'esp-numero';
    else if (a.tipo === 'lista' && a.valores_permitidos && !a.valores_permitidos.includes(String(v))) e[campo] = 'esp-lista';
  }
  return e;
}

/** Atributos que se perderían al cambiar de categoría (CA-3.4): los que tienen valor y no existen en la nueva. */
export function especificacionesQueSePierden(b: BorradorProducto, atributos: readonly Atributo[], nuevaCategoriaId: number | null): string[] {
  const nuevas = new Set(atributosDe(atributos, nuevaCategoriaId).map((a) => a.clave));
  return Object.entries(b.especificaciones)
    .filter(([clave, v]) => !nuevas.has(clave) && !vacio(v) && v !== false)
    .map(([clave]) => clave);
}

/** Borrador → producto. Solo conserva los atributos de la categoría y los convierte a su tipo. Llamar solo si `validarProducto` no dio errores. */
export function aProducto(b: BorradorProducto, atributos: readonly Atributo[], base: { id: number; created_at: string }): Producto {
  const especificaciones: Record<string, ValorEspecificacion> = {};
  for (const a of atributosDe(atributos, b.categoria_id)) {
    const v = b.especificaciones[a.clave];
    if (a.tipo === 'booleano') especificaciones[a.clave] = v === true;
    else if (!vacio(v)) especificaciones[a.clave] = a.tipo === 'numero' ? Number(v) : String(v).trim();
  }
  return {
    id: base.id,
    sku: b.sku.trim(),
    categoria_id: b.categoria_id!,
    marca_id: b.marca_id!,
    nombre: b.nombre.trim(),
    modelo: b.modelo.trim(),
    descripcion: b.descripcion.trim(),
    numero_parte: b.numero_parte.trim() || null,
    codigo_barras: b.codigo_barras.trim() || null,
    precio_usd: Number(b.precio_usd),
    stock: Number(b.stock),
    garantia_meses: Number(b.garantia_meses),
    condicion: b.condicion,
    especificaciones,
    imagenes: b.imagenes.map((i, n) => ({ url: i.url.trim(), alt: i.alt.trim(), orden: n + 1 })),
    destacado: b.destacado,
    activo: b.activo,
    created_at: base.created_at,
  };
}

export function borradorVacio(): BorradorProducto {
  return {
    sku: '', nombre: '', categoria_id: null, marca_id: null, modelo: '', numero_parte: '', codigo_barras: '', condicion: 'nuevo', garantia_meses: '12',
    descripcion: '', precio_usd: '', stock: '0', imagenes: [{ url: '', alt: '' }], especificaciones: {}, destacado: false, activo: true,
  };
}

export function aBorrador(p: Producto): BorradorProducto {
  return {
    sku: p.sku, nombre: p.nombre, categoria_id: p.categoria_id, marca_id: p.marca_id, modelo: p.modelo, numero_parte: p.numero_parte ?? '',
    codigo_barras: p.codigo_barras ?? '', condicion: p.condicion, garantia_meses: String(p.garantia_meses), descripcion: p.descripcion,
    precio_usd: String(p.precio_usd), stock: String(p.stock),
    imagenes: [...p.imagenes].sort((a, b) => a.orden - b.orden).map((i) => ({ url: i.url, alt: i.alt })),
    especificaciones: Object.fromEntries(Object.entries(p.especificaciones).map(([k, v]) => [k, typeof v === 'boolean' ? v : Array.isArray(v) ? v.join(', ') : String(v)])),
    destacado: p.destacado, activo: p.activo,
  };
}

export type EstadoAdmin = 'activo' | 'oculto' | 'agotado';
/** Oculto manda sobre agotado: un producto oculto no se vende aunque tenga unidades. */
export const estadoAdmin = (p: Pick<Producto, 'activo' | 'stock'>): EstadoAdmin => (!p.activo ? 'oculto' : p.stock <= 0 ? 'agotado' : 'activo');
export const pocasUnidades = (p: Pick<Producto, 'activo' | 'stock'>): boolean => p.activo && p.stock > 0 && p.stock <= UMBRAL_POCAS;

export interface FiltroAdmin {
  q: string;
  categoriaId: number | null;
  estado: EstadoAdmin | 'todos' | 'pocas';
}

/** CA-1.2 y 1.3: por nombre, SKU, número de parte o código de barras; por categoría (con sus subcategorías) y por estado. */
export function filtrarProductosAdmin(productos: readonly Producto[], categorias: readonly Categoria[], f: FiltroAdmin): Producto[] {
  const ids = new Set<number>();
  if (f.categoriaId !== null) {
    ids.add(f.categoriaId);
    categorias.filter((c) => c.padre_id === f.categoriaId).forEach((c) => ids.add(c.id));
  }
  const q = normalizar(f.q);
  const qc = compactar(f.q);
  return productos.filter((p) => {
    if (f.categoriaId !== null && !ids.has(p.categoria_id)) return false;
    if (f.estado === 'pocas' ? !pocasUnidades(p) : f.estado !== 'todos' && estadoAdmin(p) !== f.estado) return false;
    if (!q) return true;
    return normalizar(p.nombre).includes(q) || [p.sku, p.numero_parte ?? '', p.codigo_barras ?? ''].some((x) => x && compactar(x).includes(qc));
  });
}
