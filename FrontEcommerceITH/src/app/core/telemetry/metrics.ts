import { Evento, ResumenTarea, TareaId } from './telemetry.models';

const segundos = (ms: number) => Math.round(ms / 100) / 10; // 1 decimal

/** SUS (0–100): impares `r − 1`, pares `5 − r`, `suma × 2.5` (CA-5.4). */
export function puntajeSus(respuestas: number[]): number {
  return respuestas.reduce((suma, r, i) => suma + (i % 2 === 0 ? r - 1 : 5 - r), 0) * 2.5;
}

/**
 * Tiempo "activo" de cada evento: se le resta todo el tiempo que la pestaña estuvo oculta antes de él.
 * Así cualquier diferencia entre dos eventos ya descuenta la pestaña oculta (CA-2.5).
 */
function tiemposActivos(eventos: Evento[]): number[] {
  let oculto = 0;
  let desde: number | null = null;
  return eventos.map((ev) => {
    if (ev.e === 'visibility') {
      if (ev.d?.['estado'] === 'hidden' && desde === null) desde = ev.t;
      if (ev.d?.['estado'] === 'visible' && desde !== null) {
        oculto += ev.t - desde;
        desde = null;
      }
    }
    return ev.t - oculto - (desde !== null ? ev.t - desde : 0);
  });
}

const ordenar = (eventos: Evento[]) => [...eventos].sort((a, b) => a.t - b.t);

/** Permanencia por página (patrón de ruta) y por zona, sin el tiempo con la pestaña oculta, en segundos (CA-3.2). */
export function permanencia(eventosSinOrden: Evento[]): { paginas: Record<string, number>; zonas: Record<string, Record<string, number>> } {
  const eventos = ordenar(eventosSinOrden);
  const activos = tiemposActivos(eventos);
  const paginas: Record<string, number> = {};
  const zonas: Record<string, Record<string, number>> = {};
  let pagina: { p: string; t: number } | null = null;
  const abiertas = new Map<string, { p: string; t: number }>();

  const cerrarPagina = (t: number) => {
    if (pagina) paginas[pagina.p] = (paginas[pagina.p] ?? 0) + (t - pagina.t);
    pagina = null;
  };

  eventos.forEach((ev, i) => {
    const t = activos[i];
    if (ev.e === 'page_enter') {
      cerrarPagina(t);
      pagina = { p: ev.p, t };
    } else if (ev.e === 'page_leave') {
      cerrarPagina(t);
    } else if (ev.e === 'zone_enter' && ev.z) {
      abiertas.set(ev.z, { p: ev.p, t });
    } else if (ev.e === 'zone_leave' && ev.z) {
      const abierta = abiertas.get(ev.z);
      if (abierta) {
        const porZona = (zonas[abierta.p] ??= {});
        porZona[ev.z] = (porZona[ev.z] ?? 0) + (t - abierta.t);
        abiertas.delete(ev.z);
      }
    }
  });
  if (eventos.length) cerrarPagina(activos[activos.length - 1]);

  const aSeg = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, ms]) => [k, segundos(ms)]));
  return { paginas: aSeg(paginas), zonas: Object.fromEntries(Object.entries(zonas).map(([p, z]) => [p, aSeg(z)])) };
}

/** Primera visita de cada página: segundos desde `page_enter` hasta el primer contacto con `cta-principal` (CA-3.2). */
export function tiempoHastaCta(eventosSinOrden: Evento[]): Record<string, number> {
  const eventos = ordenar(eventosSinOrden);
  const activos = tiemposActivos(eventos);
  const resultado: Record<string, number> = {};
  let entrada: { p: string; t: number } | null = null;
  eventos.forEach((ev, i) => {
    if (ev.e === 'page_enter') entrada = { p: ev.p, t: activos[i] };
    else if (entrada && ev.z === 'cta-principal' && (ev.e === 'zone_enter' || ev.e === 'click') && !(entrada.p in resultado)) {
      resultado[entrada.p] = segundos(activos[i] - entrada.t);
      entrada = null;
    }
  });
  return resultado;
}

const porPagina = (eventos: Evento[], filtro: (ev: Evento) => boolean) =>
  eventos.filter(filtro).reduce<Record<string, number>>((acc, ev) => ({ ...acc, [ev.p]: (acc[ev.p] ?? 0) + 1 }), {});

/** Clics sobre elementos no interactivos, por página (CA-3.3). */
export const clicsMuertos = (eventos: Evento[]) => porPagina(eventos, (ev) => ev.e === 'click' && ev.d?.['interactivo'] === false);

/** Ráfagas de ≥ 3 clics en un radio de 30 px en < 1 s, por página (CA-3.3). Cada ráfaga cuenta una vez. */
export function clicsFrustracion(eventosSinOrden: Evento[]): Record<string, number> {
  const resultado: Record<string, number> = {};
  const clics = ordenar(eventosSinOrden).filter((ev) => ev.e === 'click' && ev.x !== undefined && ev.y !== undefined);
  const cerca = (a: Evento, b: Evento) => a.p === b.p && a.f === b.f && Math.hypot(a.x! - b.x!, a.y! - b.y!) <= 30;

  for (let i = 0; i < clics.length; ) {
    let j = i + 1;
    while (j < clics.length && clics[j].t - clics[i].t < 1000 && cerca(clics[i], clics[j])) j++;
    if (j - i >= 3) {
      resultado[clics[i].p] = (resultado[clics[i].p] ?? 0) + 1;
      i = j;
    } else {
      i++;
    }
  }
  return resultado;
}

const esError = (ev: Evento) =>
  ev.e === 'help_requested' || ev.e === 'form_error' || ev.e === 'back_navigation' || (ev.e === 'add_to_cart' && ev.d?.['compatible'] === false);

/** Un renglón por intento de tarea (de `task_start` a `task_end`) (CA-3.1, definición de error de R2). */
export function resumenPorTarea(eventosSinOrden: Evento[], ideales: Record<TareaId, number>): ResumenTarea[] {
  const eventos = ordenar(eventosSinOrden);
  const resumen: ResumenTarea[] = [];
  let actual: { inicio: Evento; errores: number; clics: number } | null = null;

  for (const ev of eventos) {
    if (ev.e === 'task_start' && ev.k) {
      actual = { inicio: ev, errores: 0, clics: 0 };
    } else if (actual && ev.e === 'task_end') {
      const tarea = actual.inicio.k!;
      const ideal = ideales[tarea];
      resumen.push({
        tarea,
        tiempoS: segundos(ev.t - actual.inicio.t),
        resultado: (ev.d?.['resultado'] as ResumenTarea['resultado']) ?? null,
        errores: actual.errores,
        clics: actual.clics,
        clicsIdeales: ideal,
        razonClics: ideal ? Math.round((actual.clics / ideal) * 100) / 100 : null,
      });
      actual = null;
    } else if (actual) {
      if (esError(ev)) actual.errores++;
      if (ev.e === 'click') actual.clics++;
    }
  }
  return resumen;
}
