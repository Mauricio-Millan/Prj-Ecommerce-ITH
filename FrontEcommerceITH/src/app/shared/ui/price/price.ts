import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencyService, Moneda } from '../../../core/currency/currency.service';
import { TipoCambio } from '../../../core/currency/exchange-rate.api';
import { aCentimos, deCentimos, precioPenCentimos } from '../../../core/currency/money';
import { LanguageService } from '../../../core/i18n/language.service';

/** `Intl` no soporta bien el quechua: se formatea como es-PE. */
const localeDe = (lang: string) => (lang === 'qu-PE' ? 'es-PE' : lang);

/** Monto a mostrar, en céntimos. Sin tipo de cambio cae a USD (CA-3.5). El precio guardado siempre es USD (CA-3.8). */
export function convertir(usd: number, moneda: Moneda, tc: number | null): { centimos: number; moneda: Moneda } {
  return moneda === 'PEN' && tc ? { centimos: precioPenCentimos(usd, tc), moneda: 'PEN' } : { centimos: aCentimos(usd), moneda: 'USD' };
}

export function formatear(centimos: number, moneda: Moneda, lang: string): string {
  // Los soles siempre con el símbolo `S/` (CA-3.1): en `en-US` Intl escribiría "PEN 224.63".
  return new Intl.NumberFormat(moneda === 'PEN' ? 'es-PE' : localeDe(lang), {
    style: 'currency', currency: moneda, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(deCentimos(centimos));
}

/** Tipo de cambio y su fecha con el formato del idioma ("3.75", "05/10/2026"). Lo usan la nota y el pie de página. */
export function formatearTc(tc: TipoCambio, lang: string): { tc: string; fecha: string } {
  const locale = localeDe(lang);
  return {
    tc: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(tc.valor)),
    fecha: new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(tc.fecha)),
  };
}

/** Único lugar de conversión y formato de precios del frontend (constitución § 3.3). */
@Component({
  selector: 'app-price',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="font-semibold tabular-nums">{{ texto() }}</span>
    @if (nota(); as n) {
      <span class="block text-xs text-muted">{{ 'currency.reference' | transloco: n }}</span>
    }
  `,
})
export class Price {
  readonly usd = input.required<number>();
  /** En las cuadrículas se pasa `false` y la nota se muestra una sola vez sobre el listado (H8). */
  readonly mostrarNota = input(true);

  private readonly currency = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;

  protected readonly texto = computed(() => {
    const vigente = this.currency.exchangeRate();
    const { centimos, moneda } = convertir(this.usd(), this.currency.currency(), vigente ? Number(vigente.valor) : null);
    return formatear(centimos, moneda, this.lang());
  });

  /**
   * PEN es el precio oficial: no lleva nota. Al ver en USD: "Referencial · Pagas en soles · TC 3.75" (CA-3.3 revisado).
   * Sin tipo de cambio no hay nota: el selector de moneda ya lo explica (CA-3.5).
   */
  protected readonly nota = computed(() => {
    const vigente = this.currency.exchangeRate();
    if (!this.mostrarNota() || this.currency.currency() !== 'USD' || !vigente) return null;
    return formatearTc(vigente, this.lang());
  });
}
