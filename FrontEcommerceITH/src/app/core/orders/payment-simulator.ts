import { NEVER, Observable, catchError, map, of, timeout, timer } from 'rxjs';
import { MetodoPago, ResultadoCobro } from './orders.models';

export const DEMORA_MS = 1500;
export const SIN_RESPUESTA_MS = 10_000;

export interface DatoPago {
  /** Tarjeta: el número, con o sin espacios. */
  numero?: string;
  /** Yape: el código de aprobación. */
  codigo?: string;
}

/** Los datos de prueba de la CA-4.5. */
export function resultadoDePrueba(metodo: MetodoPago, dato: DatoPago): ResultadoCobro {
  if (metodo === 'tarjeta') {
    const numero = (dato.numero ?? '').replace(/\s/g, '');
    return numero === '4000000000000002' ? 'rechazado' : numero === '4000000000000119' ? 'sin_respuesta' : 'aprobado';
  }
  return dato.codigo === '000000' ? 'rechazado' : dato.codigo === '999999' ? 'sin_respuesta' : 'aprobado';
}

/**
 * Pasarela simulada (Fase 1). Responde a los 1.5 s; "sin respuesta" es una respuesta que nunca llega y se corta a los 10 s (CA-5.3).
 * NO guarda ni registra el dato recibido (CA-4.6): solo lo usa para decidir el resultado.
 */
export function simular(metodo: MetodoPago, dato: DatoPago): Observable<{ resultado: ResultadoCobro; referencia: string | null }> {
  const resultado = resultadoDePrueba(metodo, dato);
  if (resultado === 'sin_respuesta') {
    return NEVER.pipe(
      timeout({ first: SIN_RESPUESTA_MS }),
      catchError(() => of({ resultado: 'sin_respuesta' as const, referencia: null })),
    );
  }
  return timer(DEMORA_MS).pipe(map(() => ({ resultado, referencia: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}` })));
}
