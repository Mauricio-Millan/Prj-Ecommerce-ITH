import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { localStore } from '../storage/local-store';

/** `valor` es string para no perder precisión decimal (igual que la API de la Fase 2). */
export interface TipoCambio {
  valor: string;
  fecha: string;
}

const KEY = 'tipos_cambio';

@Injectable({ providedIn: 'root' })
export class ExchangeRateApi {
  private readonly http = inject(HttpClient);

  /** El vigente es el registro más reciente. `null` si no hay ninguno (CA-3.5). */
  obtenerVigente(): Observable<TipoCambio | null> {
    const guardados = localStore.get<TipoCambio[]>(KEY);
    const lista$ = guardados
      ? of(guardados)
      : this.http.get<TipoCambio[]>('data/seed/tipos-cambio.json').pipe(
          tap((semilla) => localStore.set(KEY, semilla)),
          catchError(() => of<TipoCambio[]>([])),
        );
    return lista$.pipe(
      map((lista) => lista.reduce<TipoCambio | null>((vigente, tc) => (!vigente || tc.fecha > vigente.fecha ? tc : vigente), null)),
    );
  }
}
