import { ParamMap } from '@angular/router';
import { Atributo } from './catalog.models';
import { FiltrosActivos, Rango, entradas } from './filters.logic';

/** Parámetros de la URL que no son filtros de atributo (spec 002 § 3.1; `compat` lo agrega la 003). */
export const CLAVES_FIJAS = ['sub', 'marca', 'precio', 'disp', 'compat'] as const;

const lista = (s: string | null) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** `100-300`, `-300` (solo máximo), `100-` (solo mínimo). Lo que no se entiende se ignora. */
export function leerRango(s: string | null): Rango | undefined {
  if (!s || !s.includes('-')) return undefined;
  const [a, b] = s.split('-');
  const min = a === '' ? undefined : Number(a);
  const max = b === '' ? undefined : Number(b);
  if ((min !== undefined && Number.isNaN(min)) || (max !== undefined && Number.isNaN(max))) return undefined;
  if (min === undefined && max === undefined) return undefined;
  return { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
}

const textoRango = (r: Rango) => `${r.min ?? ''}-${r.max ?? ''}`;

/**
 * Los filtros como parámetros de la URL: `sub=memoria-ram-pc`, `marca=3,7`, `precio=100-300` (en USD), `disp=1`,
 * `tipo_ram=DDR4,DDR5`, `capacidad_gb=16-32`, `incluye_disipador=1`.
 * Las claves de `conocidas` que no estén activas salen en `null`: con `queryParamsHandling: 'merge'` eso las borra de la URL.
 */
export function aUrl(a: FiltrosActivos, conocidas: readonly string[] = []): Record<string, string | null> {
  const r: Record<string, string | null> = Object.fromEntries([...CLAVES_FIJAS, ...conocidas].map((k) => [k, null]));
  if (a.subcategoria?.length) r['sub'] = a.subcategoria.join(',');
  if (a.marca?.length) r['marca'] = a.marca.join(',');
  if (a.precio && (a.precio.min !== undefined || a.precio.max !== undefined)) r['precio'] = textoRango(a.precio);
  if (a.disponible) r['disp'] = '1';
  if (a.compatible) r['compat'] = '1';
  for (const [clave, f] of Object.entries(a.atributos)) {
    if (Array.isArray(f)) {
      if (f.length) r[clave] = f.join(',');
    } else if (typeof f === 'boolean') {
      if (f) r[clave] = '1';
    } else if (f.min !== undefined || f.max !== undefined) {
      r[clave] = textoRango(f);
    }
  }
  return r;
}

/** Lee los filtros de la URL; los parámetros desconocidos se ignoran. Conserva el orden de la URL (para "quitar el último"). */
export function desdeUrl(params: ParamMap, atributos: readonly Atributo[]): FiltrosActivos {
  const porClave = new Map(atributos.map((a) => [a.clave, a]));
  const a: FiltrosActivos = { atributos: {} };

  for (const clave of params.keys) {
    const valor = params.get(clave);
    if (clave === 'sub') {
      const v = lista(valor);
      if (v.length) a.subcategoria = v;
    } else if (clave === 'marca') {
      const v = lista(valor).map(Number).filter(Number.isFinite);
      if (v.length) a.marca = v;
    } else if (clave === 'precio') {
      const r = leerRango(valor);
      if (r) a.precio = r;
    } else if (clave === 'disp') {
      if (valor === '1') a.disponible = true;
    } else if (clave === 'compat') {
      if (valor === '1') a.compatible = true;
    } else {
      const at = porClave.get(clave);
      if (!at) continue;
      if (at.tipo === 'lista') {
        const v = lista(valor);
        if (v.length) a.atributos[clave] = v;
      } else if (at.tipo === 'numero') {
        const r = leerRango(valor);
        if (r) a.atributos[clave] = r;
      } else if (at.tipo === 'booleano' && valor === '1') {
        a.atributos[clave] = true;
      }
    }
  }
  return a;
}

/** ¿Hay algún filtro aplicado? */
export const hayFiltros = (a: FiltrosActivos) => entradas(a).length > 0;
