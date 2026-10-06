import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { localStore } from '../storage/local-store';
import { ExchangeRateApi, TipoCambio } from './exchange-rate.api';

export type Moneda = 'PEN' | 'USD';

const KEY = 'currency';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly api = inject(ExchangeRateApi);

  private readonly elegida = signal<Moneda>(localStore.get<Moneda>(KEY) === 'USD' ? 'USD' : 'PEN'); // PEN por defecto (CA-3.1)
  readonly exchangeRate = signal<TipoCambio | null>(null);
  readonly penDisponible = computed(() => this.exchangeRate() !== null);
  /** Moneda efectiva: sin tipo de cambio nunca se muestra PEN (CA-3.5, H5). */
  readonly currency = computed<Moneda>(() => (this.penDisponible() ? this.elegida() : 'USD'));

  /** Se llama al arrancar, para no mostrar USD y luego saltar a PEN. */
  init(): Observable<unknown> {
    return this.api.obtenerVigente().pipe(tap((tc) => this.exchangeRate.set(tc)));
  }

  setCurrency(moneda: Moneda): void {
    if (moneda === 'PEN' && !this.penDisponible()) return;
    this.elegida.set(moneda);
    localStore.set(KEY, moneda);
  }
}
