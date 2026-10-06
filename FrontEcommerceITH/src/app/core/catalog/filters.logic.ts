import { Atributo, Categoria, Marca, Producto, ValorEspecificacion } from './catalog.models';

export interface Rango {
  min?: number;
  max?: number;
}

/** El precio va SIEMPRE en USD (la URL y la lógica); el panel convierte desde y hacia la moneda activa (CA-5.6). */
export interface FiltrosActivos {
  subcategoria?: string[];
  marca?: number[];
  precio?: Rango;
  disponible?: boolean;
  /** Solo lo compatible con "Mi equipo" (spec 003, `compat=1`). */
  compatible?: boolean;
  atributos: Record<string, string[] | Rango | boolean>;
}

export const FILTROS_VACIOS: FiltrosActivos = { atributos: {} };

export interface ContextoFiltros {
  categorias: readonly Categoria[];
  marcas: readonly Marca[];
  atributos: readonly Atributo[];
  /** Spec 003. Sin esto (o sin equipo) el filtro de compatibilidad no existe. */
  compat?: { hayEquipo: boolean; aplica: (p: Producto) => boolean; compatible: (p: Producto) => boolean };
}

export interface OpcionFaceta {
  valor: string;
  /** Texto literal (marcas, valores técnicos que no se traducen). */
  etiqueta?: string;
  /** Clave de traducción (subcategorías). */
  etiquetaClave?: string;
  cantidad: number;
  /** Dejaría la lista vacía y no está marcada: no se puede marcar (CA-5.4). */
  deshabilitada: boolean;
  marcada: boolean;
}

export interface Faceta {
  /** `sub`, `marca`, `precio`, `disp` o la clave del atributo. */
  id: string;
  tipo: 'lista' | 'rango' | 'booleano';
  etiquetaClave: string;
  /** `attr.<clave>.help` en los filtros técnicos (CA-5.9). */
  ayudaClave: string | null;
  tecnica: boolean;
  /** Entre las primeras 6; el resto va en "Más filtros" (CA-5.2). */
  visible: boolean;
  opciones: OpcionFaceta[];
  min: number;
  max: number;
  unidad: string | null;
  esPrecio: boolean;
  /** Booleano: cuántos productos quedarían al marcarlo. */
  cantidad: number;
  marcada: boolean;
  rangoActual: Rango | null;
}

export const MAX_FACETAS_VISIBLES = 6;

const valoresComoTexto = (v: ValorEspecificacion | undefined): string[] =>
  v === undefined || typeof v === 'boolean' ? [] : Array.isArray(v) ? v : [String(v)];

const enRango = (n: number, r: Rango | undefined) => !r || ((r.min === undefined || n >= r.min - 1e-9) && (r.max === undefined || n <= r.max + 1e-9));

const slugDe = (p: Producto, ctx: ContextoFiltros) => ctx.categorias.find((c) => c.id === p.categoria_id)?.slug ?? '';

/** ¿El producto cumple los filtros? `excluir` omite una faceta: así se calculan las cantidades de esa faceta (plan § 3). */
function pasa(p: Producto, a: FiltrosActivos, ctx: ContextoFiltros, excluir?: string): boolean {
  if (excluir !== 'sub' && a.subcategoria?.length && !a.subcategoria.includes(slugDe(p, ctx))) return false;
  if (excluir !== 'marca' && a.marca?.length && !a.marca.includes(p.marca_id)) return false;
  if (excluir !== 'precio' && !enRango(p.precio_usd, a.precio)) return false;
  if (excluir !== 'disp' && a.disponible && p.stock <= 0) return false;
  if (excluir !== 'compat' && a.compatible && ctx.compat?.hayEquipo && !ctx.compat.compatible(p)) return false;
  for (const [clave, f] of Object.entries(a.atributos)) {
    if (clave === excluir) continue;
    const v = p.especificaciones[clave];
    if (Array.isArray(f)) {
      if (f.length && !valoresComoTexto(v).some((x) => f.includes(x))) return false;
    } else if (typeof f === 'boolean') {
      if (f && v !== true) return false;
    } else {
      const n = typeof v === 'number' ? v : Number.NaN;
      if (Number.isNaN(n) || !enRango(n, f)) return false;
    }
  }
  return true;
}

/** OR dentro de una faceta, AND entre facetas (CA-5.5). */
export const aplicar = (productos: readonly Producto[], a: FiltrosActivos, ctx: ContextoFiltros): Producto[] => productos.filter((p) => pasa(p, a, ctx));

/**
 * Nivel (CA-5.1): si todos los productos —tras el filtro de subcategoría— son de UNA sola subcategoría, se agregan sus filtros técnicos.
 */
export function nivel(productos: readonly Producto[]): { tecnico: boolean; subcategoriaId: number | null } {
  const ids = new Set(productos.map((p) => p.categoria_id));
  return ids.size === 1 ? { tecnico: true, subcategoriaId: [...ids][0] } : { tecnico: false, subcategoriaId: null };
}

type DefLista = { valor: string; etiqueta?: string; etiquetaClave?: string };

function faceta(id: string, tipo: Faceta['tipo'], etiquetaClave: string, extra: Partial<Faceta> = {}): Faceta {
  return {
    id, tipo, etiquetaClave, ayudaClave: null, tecnica: false, visible: false, opciones: [], min: 0, max: 0, unidad: null, esPrecio: false,
    cantidad: 0, marcada: false, rangoActual: null, ...extra,
  };
}

/**
 * Facetas de la lista (CA-5.1–5.4). Las cantidades de cada faceta se calculan con TODOS los demás filtros menos los de ella: así se
 * puede sumar DDR4 **o** DDR5 sin que las cantidades se vuelvan 0. Las facetas con una sola opción posible no se devuelven.
 */
export function facetas(productos: readonly Producto[], ctx: ContextoFiltros, a: FiltrosActivos): Faceta[] {
  const soloSub = productos.filter((p) => !a.subcategoria?.length || a.subcategoria.includes(slugDe(p, ctx)));
  const niv = nivel(soloSub);
  const resultado: Faceta[] = [];

  const lista = (id: string, etiquetaClave: string, defs: DefLista[], valoresDe: (p: Producto) => string[], marcados: string[], extra: Partial<Faceta> = {}) => {
    const base = productos.filter((p) => pasa(p, a, ctx, id));
    const opciones = defs
      .map<OpcionFaceta>((d) => {
        const cantidad = base.filter((p) => valoresDe(p).includes(d.valor)).length;
        const marcada = marcados.includes(d.valor);
        return { ...d, cantidad, marcada, deshabilitada: cantidad === 0 && !marcada };
      });
    if (opciones.length > 1 || opciones.some((o) => o.marcada)) resultado.push(faceta(id, 'lista', etiquetaClave, { opciones, ...extra }));
  };

  const rango = (id: string, etiquetaClave: string, valoresDe: (p: Producto) => number | null, actual: Rango | undefined, extra: Partial<Faceta> = {}) => {
    const valores = productos.map(valoresDe).filter((n): n is number => n !== null);
    if (!valores.length) return;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    if (min !== max || actual) resultado.push(faceta(id, 'rango', etiquetaClave, { min, max, rangoActual: actual ?? null, marcada: !!actual, ...extra }));
  };

  const booleano = (id: string, etiquetaClave: string, cumple: (p: Producto) => boolean, marcada: boolean, extra: Partial<Faceta> = {}) => {
    const base = productos.filter((p) => pasa(p, a, ctx, id));
    const cantidad = base.filter(cumple).length;
    const total = productos.filter(cumple).length;
    // Si todos o ninguno lo cumplen, no filtra nada (salvo que ya esté marcado, para poder quitarlo).
    if ((total > 0 && total < productos.length) || marcada) resultado.push(faceta(id, 'booleano', etiquetaClave, { cantidad, marcada, ...extra }));
  };

  // — primer lugar: compatible con mi equipo (spec 003, CA-3.1). Solo si hay equipo y algún producto del listado aplica —
  if (ctx.compat?.hayEquipo && productos.some(ctx.compat.aplica)) {
    const cantidad = productos.filter((p) => pasa(p, a, ctx, 'compat')).filter(ctx.compat.compatible).length;
    resultado.push(faceta('compat', 'booleano', 'compat.filter', { cantidad, marcada: !!a.compatible }));
  }

  // — comunes: subcategoría, marca, precio, disponibilidad —
  const subs = ctx.categorias
    .filter((c) => c.padre_id !== null && productos.some((p) => p.categoria_id === c.id))
    .sort((x, y) => x.orden - y.orden)
    .map<DefLista>((c) => ({ valor: c.slug, etiquetaClave: c.clave_i18n }));
  lista('sub', 'filters.sub', subs, (p) => [slugDe(p, ctx)], a.subcategoria ?? []);

  const marcas = ctx.marcas
    .filter((m) => productos.some((p) => p.marca_id === m.id))
    .sort((x, y) => x.nombre.localeCompare(y.nombre))
    .map<DefLista>((m) => ({ valor: String(m.id), etiqueta: m.nombre }));
  lista('marca', 'filters.brand', marcas, (p) => [String(p.marca_id)], (a.marca ?? []).map(String));

  rango('precio', 'filters.price', (p) => p.precio_usd, a.precio, { esPrecio: true });
  booleano('disp', 'filters.availability', (p) => p.stock > 0, !!a.disponible);

  // — técnicos: solo al nivel de una subcategoría (CA-5.1) —
  if (niv.tecnico) {
    const atributos = ctx.atributos.filter((x) => x.categoria_id === niv.subcategoriaId && x.filtrable).sort((x, y) => x.orden - y.orden);
    for (const at of atributos) {
      const extra: Partial<Faceta> = { tecnica: true, ayudaClave: at.clave_i18n.replace(/\.label$/, '.help'), unidad: at.unidad };
      const actual = a.atributos[at.clave];
      if (at.tipo === 'lista') {
        const vistos = new Set(soloSub.flatMap((p) => valoresComoTexto(p.especificaciones[at.clave])));
        const orden = at.valores_permitidos ?? [...vistos].sort();
        const defs = orden.filter((v) => vistos.has(v)).map<DefLista>((v) => ({ valor: v, etiqueta: v }));
        lista(at.clave, at.clave_i18n, defs, (p) => valoresComoTexto(p.especificaciones[at.clave]), Array.isArray(actual) ? actual : [], extra);
      } else if (at.tipo === 'numero') {
        rango(at.clave, at.clave_i18n, (p) => (typeof p.especificaciones[at.clave] === 'number' ? (p.especificaciones[at.clave] as number) : null), actual && !Array.isArray(actual) && typeof actual !== 'boolean' ? actual : undefined, extra);
      } else if (at.tipo === 'booleano') {
        booleano(at.clave, at.clave_i18n, (p) => p.especificaciones[at.clave] === true, actual === true, extra);
      }
    }
  }

  // Los 6 primeros se despliegan; el resto queda en "Más filtros" (CA-5.2).
  resultado.forEach((f, i) => (f.visible = i < MAX_FACETAS_VISIBLES));
  return resultado;
}

// ───────────── cambios de filtros (funciones puras que usan el panel, las etiquetas y el listado) ─────────────

const copiar = (a: FiltrosActivos): FiltrosActivos => ({ ...a, atributos: { ...a.atributos } });
const conRangoVacio = (r: Rango | null | undefined) => !r || (r.min === undefined && r.max === undefined);

export function alternarOpcion(a: FiltrosActivos, faceta: Faceta, valor: string): FiltrosActivos {
  const nuevo = copiar(a);
  const alternar = <T>(lista: T[] | undefined, v: T): T[] | undefined => {
    const base = lista ?? [];
    const r = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    return r.length ? r : undefined;
  };
  if (faceta.id === 'sub') nuevo.subcategoria = alternar(a.subcategoria, valor);
  else if (faceta.id === 'marca') nuevo.marca = alternar(a.marca, Number(valor));
  else {
    const actual = Array.isArray(a.atributos[faceta.id]) ? (a.atributos[faceta.id] as string[]) : undefined;
    const r = alternar(actual, valor);
    if (r) nuevo.atributos[faceta.id] = r;
    else delete nuevo.atributos[faceta.id];
  }
  return nuevo;
}

export function fijarRango(a: FiltrosActivos, faceta: Faceta, rango: Rango | null): FiltrosActivos {
  const nuevo = copiar(a);
  const r = conRangoVacio(rango) ? undefined : rango!;
  if (faceta.id === 'precio') nuevo.precio = r;
  else if (r) nuevo.atributos[faceta.id] = r;
  else delete nuevo.atributos[faceta.id];
  return nuevo;
}

export function fijarBooleano(a: FiltrosActivos, faceta: Faceta, valor: boolean): FiltrosActivos {
  const nuevo = copiar(a);
  if (faceta.id === 'disp') nuevo.disponible = valor || undefined;
  else if (faceta.id === 'compat') nuevo.compatible = valor || undefined;
  else if (valor) nuevo.atributos[faceta.id] = true;
  else delete nuevo.atributos[faceta.id];
  return nuevo;
}

export interface Entrada {
  id: string;
  valor: string;
}

export const textoRango = (r: Rango) => `${r.min ?? ''}-${r.max ?? ''}`;

/** Cada filtro aplicado como una entrada (id + valor): son las etiquetas con ✕ (CA-5.7) y la base del registro `filter` (CA-6.3). */
export function entradas(a: FiltrosActivos): Entrada[] {
  const r: Entrada[] = [];
  a.subcategoria?.forEach((v) => r.push({ id: 'sub', valor: v }));
  a.marca?.forEach((v) => r.push({ id: 'marca', valor: String(v) }));
  if (a.precio && !conRangoVacio(a.precio)) r.push({ id: 'precio', valor: textoRango(a.precio) });
  if (a.disponible) r.push({ id: 'disp', valor: '1' });
  if (a.compatible) r.push({ id: 'compat', valor: '1' });
  for (const [clave, f] of Object.entries(a.atributos)) {
    if (Array.isArray(f)) f.forEach((v) => r.push({ id: clave, valor: v }));
    else if (typeof f === 'boolean') {
      if (f) r.push({ id: clave, valor: '1' });
    } else if (!conRangoVacio(f)) r.push({ id: clave, valor: textoRango(f) });
  }
  return r;
}

export function quitarEntrada(a: FiltrosActivos, e: Entrada): FiltrosActivos {
  const nuevo = copiar(a);
  const sin = <T>(lista: T[] | undefined, v: T) => {
    const r = (lista ?? []).filter((x) => x !== v);
    return r.length ? r : undefined;
  };
  if (e.id === 'sub') nuevo.subcategoria = sin(a.subcategoria, e.valor);
  else if (e.id === 'marca') nuevo.marca = sin(a.marca, Number(e.valor));
  else if (e.id === 'precio') nuevo.precio = undefined;
  else if (e.id === 'disp') nuevo.disponible = undefined;
  else if (e.id === 'compat') nuevo.compatible = undefined;
  else {
    const f = a.atributos[e.id];
    const r = Array.isArray(f) ? sin(f, e.valor) : undefined;
    if (r) nuevo.atributos[e.id] = r;
    else delete nuevo.atributos[e.id];
  }
  return nuevo;
}

/** Qué se aplicó y qué se quitó entre dos estados: alimenta el evento `filter` (CA-6.3). */
export function diferencia(antes: FiltrosActivos, despues: FiltrosActivos): (Entrada & { accion: 'aplicar' | 'quitar' })[] {
  const clave = (e: Entrada) => `${e.id}|${e.valor}`;
  const a = entradas(antes);
  const d = entradas(despues);
  const dentroDe = (lista: Entrada[], e: Entrada) => lista.some((x) => clave(x) === clave(e));
  return [
    ...d.filter((e) => !dentroDe(a, e)).map((e) => ({ ...e, accion: 'aplicar' as const })),
    ...a.filter((e) => !dentroDe(d, e)).map((e) => ({ ...e, accion: 'quitar' as const })),
  ];
}

/**
 * "Quitar el último filtro" (CA-4.2): el último de la lista, que sigue el orden de la URL.
 * ponytail: el orden entre las claves fijas (sub, marca, precio, disp) y los atributos es el de `entradas()`, no el cronológico real.
 */
export function quitarUltimo(a: FiltrosActivos): FiltrosActivos {
  const todas = entradas(a);
  return todas.length ? quitarEntrada(a, todas[todas.length - 1]) : a;
}
