import { clicsFrustracion, clicsMuertos, permanencia, resumenPorTarea, tiempoHastaCta } from './metrics';
import { CAMINOS_IDEALES, Evento, RespuestaSus } from './telemetry.models';

type Celda = string | number | null | undefined;

/** RFC 4180: se citan los valores con comas, comillas o saltos de línea. */
const celda = (v: Celda) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fila = (valores: Celda[]) => valores.map(celda).join(',');
const tabla = (cabecera: string[], filas: Celda[][]) => [fila(cabecera), ...filas.map(fila)].join('\r\n');

export const aJSON = (eventos: Evento[]) => JSON.stringify(eventos);

export function aCSV(eventos: Evento[]): string {
  return tabla(
    ['sesion', 'version', 'tiempo_ms', 'evento', 'ruta', 'patron_ruta', 'tarea', 'x', 'y', 'fijo', 'zona', 'zona_indice', 'zona_x', 'zona_y', 'modal', 'track', 'detalle'],
    eventos.map((ev) => [ev.s, ev.v, ev.t, ev.e, ev.r, ev.p, ev.k, ev.x, ev.y, ev.f, ev.z, ev.zi, ev.zx, ev.zy, ev.m, ev.tr, ev.d ? JSON.stringify(ev.d) : '']),
  );
}

/** Un CSV con secciones separadas por una línea en blanco: tareas, páginas, zonas y SUS (CA-3.1–3.3, CA-5.5). */
export function resumenCSV(eventos: Evento[], sus: RespuestaSus | null): string {
  const tareas = resumenPorTarea(eventos, CAMINOS_IDEALES);
  const { paginas, zonas } = permanencia(eventos);
  const cta = tiempoHastaCta(eventos);
  const muertos = clicsMuertos(eventos);
  const frustracion = clicsFrustracion(eventos);
  const todasLasPaginas = [...new Set([...Object.keys(paginas), ...Object.keys(cta), ...Object.keys(muertos), ...Object.keys(frustracion)])];

  return [
    tabla(
      ['tarea', 'tiempo_s', 'resultado', 'errores', 'clics_reales', 'clics_ideales', 'razon_clics'],
      tareas.map((r) => [r.tarea, r.tiempoS, r.resultado, r.errores, r.clics, r.clicsIdeales || null, r.razonClics]),
    ),
    tabla(
      ['pagina', 'permanencia_s', 'tiempo_hasta_cta_s', 'clics_muertos', 'clics_frustracion'],
      todasLasPaginas.map((p) => [p, paginas[p] ?? 0, cta[p], muertos[p] ?? 0, frustracion[p] ?? 0]),
    ),
    tabla(
      ['pagina', 'zona', 'permanencia_s'],
      Object.entries(zonas).flatMap(([p, z]) => Object.entries(z).map(([nombre, s]) => [p, nombre, s])),
    ),
    tabla(['sus_puntaje'], [[sus?.puntaje]]),
  ].join('\r\n\r\n');
}

export function susCSV(sesionId: string, sus: RespuestaSus): string {
  return tabla(
    ['sesion', 'version', ...sus.respuestas.map((_, i) => `q${i + 1}`), 'puntaje'],
    [[sesionId, sus.version, ...sus.respuestas, sus.puntaje]],
  );
}

/** Descarga en el navegador. El BOM hace que Excel lea bien las tildes del CSV. */
export function descargar(nombre: string, contenido: string, mime: string): void {
  const bom = mime.startsWith('text/csv') ? '﻿' : '';
  const url = URL.createObjectURL(new Blob([bom + contenido], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Los archivos de la sesión: eventos (CSV y JSON), resumen y, si se respondió, SUS. */
export function exportarSesion(sesionId: string, eventos: Evento[], sus: RespuestaSus | null): void {
  descargar(`${sesionId}_eventos.csv`, aCSV(eventos), 'text/csv;charset=utf-8');
  descargar(`${sesionId}_eventos.json`, aJSON(eventos), 'application/json');
  descargar(`${sesionId}_resumen.csv`, resumenCSV(eventos, sus), 'text/csv;charset=utf-8');
  if (sus) descargar(`${sesionId}_sus.csv`, susCSV(sesionId, sus), 'text/csv;charset=utf-8');
}
