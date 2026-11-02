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

  private lista(): Observable<TipoCambio[]> {
    const guardados = localStore.get<TipoCambio[]>(KEY);
    return guardados
      ? of(guardados)
      : this.http.get<TipoCambio[]>('data/seed/tipos-cambio.json').pipe(
          tap((semilla) => localStore.set(KEY, semilla)),
          catchError(() => of<TipoCambio[]>([])),
        );
  }

  /** El vigente es el registro más reciente. `null` si no hay ninguno (CA-3.5). */
  obtenerVigente(): Observable<TipoCambio | null> {
    return this.lista().pipe(map((lista) => lista.reduce<TipoCambio | null>((vigente, tc) => (!vigente || tc.fecha > vigente.fecha ? tc : vigente), null)));
  }

  /** Del más reciente al más antiguo (spec 009, CA-5.1). */
  historial(): Observable<TipoCambio[]> {
    return this.lista().pipe(map((l) => [...l].sort((x, y) => y.fecha.localeCompare(x.fecha))));
  }

  /** Solo agrega: el historial no se edita ni se borra (spec 009, CA-5.3). `valor` ya validado por `valorTipoCambioValido`. */
  registrar(valor: string): Observable<TipoCambio> {
    const nuevo: TipoCambio = { valor: Number(valor).toFixed(4), fecha: new Date().toISOString() };
    return this.lista().pipe(
      map((lista) => {
        localStore.set(KEY, [...lista, nuevo]);
        return nuevo;
      }),
    );
  }
}

/** Mayor que 0, con hasta 4 decimales (spec 009, CA-5.2). */
export const valorTipoCambioValido = (valor: string): boolean => /^\d+(\.\d{1,4})?$/.test(valor.trim()) && Number(valor) > 0;
