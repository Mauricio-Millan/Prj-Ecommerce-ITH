import { Atributo, Categoria, Producto, ReglaCompatibilidad, ValorEspecificacion } from '../catalog/catalog.models';
import { cumple } from '../compat/reglas';
import { aCentimos, precioPenCentimos } from '../currency/money';
import { Armado, Candidata, Conflicto, EstadoArmado, Motivo, OMITIDO, Obligatoriedad } from './builder.models';
import { PASOS, PasoId, PasoActual, defDePaso, ordenDe, pasoDeSlug } from './pasos';

export interface ContextoArmador {
  productos: readonly Producto[];
  categorias: readonly Categoria[];
  reglas: readonly ReglaCompatibilidad[];
}

const texto = (v: ValorEspecificacion | undefined): string => (Array.isArray(v) ? v.join('/') : String(v ?? ''));
const slugDe = (p: Producto, ctx: ContextoArmador) => ctx.categorias.find((c) => c.id === p.categoria_id)?.slug ?? '';

/** La pieza elegida en un paso (`null` si está pendiente, omitido o el producto ya no existe). */
export function pieza(armado: Armado, paso: PasoId, ctx: ContextoArmador): Producto | null {
  const sku = armado.piezas[paso];
  return !sku || sku === OMITIDO ? null : (ctx.productos.find((p) => p.sku === sku) ?? null);
}

/** Las piezas elegidas por subcategoría (slug), con la candidata en lugar de la que había en su paso. */
function porSlug(armado: Armado, ctx: ContextoArmador, candidata?: { paso: PasoId; producto: Producto }, soloAnteriores = false): Map<string, Producto> {
  const mapa = new Map<string, Producto>();
  for (const def of PASOS) {
    if (soloAnteriores && candidata && ordenDe(def.id) > ordenDe(candidata.paso)) continue;
    const p = candidata?.paso === def.id ? candidata.producto : pieza(armado, def.id, ctx);
    if (p) mapa.set(def.slug, p);
  }
  return mapa;
}

/** Cuándo un paso es obligatorio (CA-1.2): la tarjeta de video sin gráficos integrados y el disipador sin el que trae el procesador. */
export function obligatorio(paso: PasoId, armado: Armado, ctx: ContextoArmador): Obligatoriedad {
  const cpu = pieza(armado, 'cpu', ctx);
  if (paso === 'gpu') {
    if (!cpu) return { obligatorio: true, motivo: null };
    return cpu.especificaciones['graficos_integrados'] === true ? { obligatorio: false, motivo: 'con_igpu' } : { obligatorio: true, motivo: 'sin_igpu' };
  }
  if (paso === 'cooler') {
    if (!cpu) return { obligatorio: true, motivo: null };
    return cpu.especificaciones['incluye_disipador'] === true ? { obligatorio: false, motivo: 'con_disipador' } : { obligatorio: true, motivo: 'sin_disipador' };
  }
  return { obligatorio: true, motivo: null };
}

/** Las reglas que relacionan las dos subcategorías, en cualquier sentido. */
export function reglasEntre(pasoA: PasoId, pasoB: PasoId, reglas: readonly ReglaCompatibilidad[]): ReglaCompatibilidad[] {
  const a = defDePaso(pasoA).slug;
  const b = defDePaso(pasoB).slug;
  return reglas.filter((r) => (r.origen.includes(a) && r.destino === b) || (r.origen.includes(b) && r.destino === a));
}

interface Evaluacion {
  /** Hay pieza de origen y de destino: la regla se puede evaluar. */
  aplica: boolean;
  /** `null` = faltan datos (no es "incompatible"). */
  cumple: boolean | null;
  origenes: { paso: PasoId; producto: Producto }[];
  destino: { paso: PasoId; producto: Producto } | null;
  /** Suma + margen, solo en la regla de potencia. */
  consumoW?: number;
  potenciaW?: number;
}

/** Evalúa UNA regla con el comparador `cumple` de la 003: una sola forma de comparar en toda la tienda. */
function evaluarRegla(r: ReglaCompatibilidad, piezas: Map<string, Producto>): Evaluacion {
  const origenes = r.origen.flatMap((slug) => (piezas.has(slug) ? [{ paso: pasoDeSlug(slug)!, producto: piezas.get(slug)! }] : []));
  const prodDestino = piezas.get(r.destino);
  const destino = prodDestino ? { paso: pasoDeSlug(r.destino)!, producto: prodDestino } : null;
  if (!origenes.length || !destino) return { aplica: false, cumple: null, origenes, destino };

  const valorDestino = destino.producto.especificaciones[r.atributo_destino];
  if (r.operador === 'suma_menor_igual') {
    const consumos = origenes.map((o) => o.producto.especificaciones[r.atributo_origen]).filter((v): v is number => typeof v === 'number');
    if (!consumos.length) return { aplica: true, cumple: null, origenes, destino };
    const consumoW = consumos.reduce((s, n) => s + n, 0) + (r.margen ?? 0);
    return { aplica: true, cumple: cumple('suma_menor_igual', [...consumos, r.margen ?? 0], valorDestino), origenes, destino, consumoW, potenciaW: typeof valorDestino === 'number' ? valorDestino : undefined };
  }
  return { aplica: true, cumple: cumple(r.operador, origenes[0].producto.especificaciones[r.atributo_origen], valorDestino), origenes, destino };
}

/**
 * ¿Calza esta pieza con lo ya elegido? Aplica TODAS las reglas que la relacionan con las piezas elegidas ANTES en el orden de armado (CA-2.2).
 * Las piezas de pasos posteriores no restringen: si el cambio no calza con ellas, se aplica y quedan marcadas como conflicto (CA-4.1);
 * por eso se puede cambiar el procesador aunque ya haya una placa elegida.
 * `false` → incompatible, con su motivo; `null` (faltan datos) → compatible, pero se avisa (como la 003).
 */
export function evaluarCandidata(sku: string, paso: PasoId, armado: Armado, ctx: ContextoArmador): Candidata {
  const producto = ctx.productos.find((p) => p.sku === sku);
  if (!producto) return { sku, compatible: false, sinDatos: false, motivos: [] };
  const slug = defDePaso(paso).slug;
  const piezas = porSlug(armado, ctx, { paso, producto }, true);
  const motivos: Motivo[] = [];
  let sinDatos = false;

  for (const r of ctx.reglas.filter((x) => x.destino === slug || x.origen.includes(slug))) {
    const ev = evaluarRegla(r, piezas);
    if (!ev.aplica) continue;
    if (ev.cumple === null) {
      sinDatos = true;
    } else if (!ev.cumple) {
      const esDestino = r.destino === slug;
      const otro = esDestino ? (ev.origenes.find((o) => o.paso !== paso) ?? ev.origenes[0]) : ev.destino!;
      const estaValor = esDestino ? ev.destino!.producto.especificaciones[r.atributo_destino] : ev.origenes.find((o) => o.paso === paso)!.producto.especificaciones[r.atributo_origen];
      const otraValor = esDestino ? otro.producto.especificaciones[r.atributo_origen] : ev.destino!.producto.especificaciones[r.atributo_destino];
      motivos.push(
        ev.consumoW !== undefined
          ? { reglaId: r.id, mensaje: r.mensaje, otroPaso: otro.paso, esta: String(ev.consumoW), otra: String(ev.potenciaW ?? ''), consumoW: ev.consumoW, potenciaW: ev.potenciaW }
          : { reglaId: r.id, mensaje: r.mensaje, otroPaso: otro.paso, esta: texto(estaValor), otra: texto(otraValor) },
      );
    }
  }
  return { sku, compatible: motivos.length === 0, sinDatos, motivos };
}

/**
 * Los pares de piezas ya elegidas que no se cumplen (CA-4.1). Se marca la pieza que va DESPUÉS en el orden de armado (la placa si el
 * procesador no le calza, la RAM si la placa no le calza…): es la que hay que revisar.
 */
export function conflictos(armado: Armado, ctx: ContextoArmador): Conflicto[] {
  const piezas = porSlug(armado, ctx);
  const resultado: Conflicto[] = [];
  for (const r of ctx.reglas) {
    const ev = evaluarRegla(r, piezas);
    if (!ev.aplica || ev.cumple !== false) continue;
    const involucrados = [...ev.origenes, ev.destino!].sort((a, b) => ordenDe(a.paso) - ordenDe(b.paso));
    const afectado = involucrados[involucrados.length - 1];
    const otro = involucrados.find((i) => i.paso !== afectado.paso)!;
    const esDestino = afectado.paso === ev.destino!.paso;
    const estaValor = esDestino ? afectado.producto.especificaciones[r.atributo_destino] : afectado.producto.especificaciones[r.atributo_origen];
    const otraValor = esDestino ? otro.producto.especificaciones[r.atributo_origen] : otro.producto.especificaciones[r.atributo_destino];
    resultado.push({
      reglaId: r.id,
      pasos: involucrados.map((i) => i.paso),
      afectado: afectado.paso,
      motivo:
        ev.consumoW !== undefined
          ? { reglaId: r.id, mensaje: r.mensaje, otroPaso: otro.paso, esta: String(ev.consumoW), otra: String(ev.potenciaW ?? ''), consumoW: ev.consumoW, potenciaW: ev.potenciaW }
          : { reglaId: r.id, mensaje: r.mensaje, otroPaso: otro.paso, esta: texto(estaValor), otra: texto(otraValor) },
    });
  }
  return resultado;
}

/** Piezas elegidas que se agotaron o dejaron de existir mientras se armaba (CA-6.3). */
export function disponibilidad(armado: Armado, ctx: ContextoArmador): PasoId[] {
  return PASOS.filter(({ id }) => {
    const sku = armado.piezas[id];
    if (!sku || sku === OMITIDO) return false;
    const p = ctx.productos.find((x) => x.sku === sku);
    return !p || !p.activo || p.stock <= 0;
  }).map((p) => p.id);
}

/** Precio en soles (céntimos enteros, `money.ts`); sin tipo de cambio, en USD como referencia. */
export const precioCentimos = (p: Producto, tc: number | null): number => (tc ? precioPenCentimos(p.precio_usd, tc) : aCentimos(p.precio_usd));

/** Todo lo que el resumen necesita (CA-3.1–3.3, 5.2). El armado está `completo` si no faltan piezas, no hay conflictos ni piezas que ya no están. */
export function estado(armado: Armado, ctx: ContextoArmador, tc: number | null): EstadoArmado {
  const faltantes = PASOS.filter(({ id }) => obligatorio(id, armado, ctx).obligatorio && (armado.piezas[id] === undefined || armado.piezas[id] === OMITIDO)).map((p) => p.id);
  const conf = conflictos(armado, ctx);
  const noDisponibles = disponibilidad(armado, ctx);
  const elegidas = PASOS.map((p) => pieza(armado, p.id, ctx)).filter((p): p is Producto => p !== null);
  const totalCentimos = elegidas.reduce((s, p) => s + precioCentimos(p, tc), 0);

  const reglaPotencia = ctx.reglas.find((r) => r.operador === 'suma_menor_igual');
  const consumos = [pieza(armado, 'cpu', ctx), pieza(armado, 'gpu', ctx)].map((p) => p?.especificaciones[reglaPotencia?.atributo_origen ?? 'consumo_w']).filter((v): v is number => typeof v === 'number');
  const consumoW = consumos.length ? consumos.reduce((s, n) => s + n, 0) + (reglaPotencia?.margen ?? 0) : 0;
  const potencia = pieza(armado, 'fuente', ctx)?.especificaciones['potencia_w'];

  return {
    faltantes,
    conflictos: conf,
    noDisponibles,
    completo: !faltantes.length && !conf.length && !noDisponibles.length,
    totalCentimos,
    consumoW,
    potenciaW: typeof potencia === 'number' ? potencia : null,
    restanteCentimos: armado.presupuestoCentimos === null ? null : armado.presupuestoCentimos - totalCentimos,
  };
}

/** El siguiente paso sin elegir ni omitir (después del actual y, si no hay, desde el principio); si todo está resuelto, el resumen (CA-1.5). */
export function siguientePendiente(desde: PasoId, armado: Armado): PasoActual {
  const i = ordenDe(desde);
  const orden = [...PASOS.slice(i + 1), ...PASOS.slice(0, i + 1)];
  return orden.find((p) => armado.piezas[p.id] === undefined)?.id ?? 'resumen';
}

/** El primer paso con conflicto o con una pieza que ya no está, para "Revisar" (CA-4.2). */
export function pasoDeConflicto(armado: Armado, ctx: ContextoArmador): PasoId | null {
  const afectados = new Set<PasoId>([...conflictos(armado, ctx).map((c) => c.afectado), ...disponibilidad(armado, ctx)]);
  return PASOS.find((p) => afectados.has(p.id))?.id ?? null;
}

/** Las piezas ya elegidas en pasos anteriores que se relacionan con este paso por alguna regla: "compatibles con tu Ryzen 5 7600" (CA-2.2). */
export function piezasRelacionadas(paso: PasoId, armado: Armado, ctx: ContextoArmador): Producto[] {
  return PASOS.filter((p) => ordenDe(p.id) < ordenDe(paso) && reglasEntre(paso, p.id, ctx.reglas).length > 0)
    .map((p) => pieza(armado, p.id, ctx))
    .filter((p): p is Producto => p !== null);
}

/** Las 2 o 3 especificaciones clave del paso, ya formateadas como en la ficha (CA-2.1, H6, H7). */
export function specsClave(p: Producto, paso: PasoId, atributos: readonly Atributo[]): { etiqueta: string; siNo?: boolean; texto: string }[] {
  return defDePaso(paso).specs.flatMap((clave) => {
    const at = atributos.find((a) => a.categoria_id === p.categoria_id && a.clave === clave);
    const v = p.especificaciones[clave];
    if (!at || v === undefined) return [];
    return [{ etiqueta: at.clave_i18n, siNo: typeof v === 'boolean' ? v : undefined, texto: Array.isArray(v) ? v.join(', ') : at.unidad ? `${v} ${at.unidad}` : String(v) }];
  });
}

/** Las piezas del paso con su evaluación: compatibles y con stock primero, luego las agotadas y al final las no compatibles. */
export function candidatas(paso: PasoId, armado: Armado, ctx: ContextoArmador): { producto: Producto; evaluacion: Candidata }[] {
  const slug = defDePaso(paso).slug;
  const rango = (c: { producto: Producto; evaluacion: Candidata }) => (!c.evaluacion.compatible ? 2 : c.producto.stock <= 0 ? 1 : 0);
  return ctx.productos
    .filter((p) => p.activo && slugDe(p, ctx) === slug)
    .map((producto) => ({ producto, evaluacion: evaluarCandidata(producto.sku, paso, armado, ctx) }))
    .sort((a, b) => rango(a) - rango(b) || a.producto.precio_usd - b.producto.precio_usd);
}
