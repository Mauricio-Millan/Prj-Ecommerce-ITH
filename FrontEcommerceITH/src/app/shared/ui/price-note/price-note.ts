import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencyService } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatearTc } from '../price/price';

/**
 * La nota "Referencial · Pagas en soles · TC …" que `<app-price>` muestra bajo cada precio, pero una sola vez:
 * se usa sobre las cuadrículas, que pasan `[mostrarNota]="false"` a cada tarjeta (H8). Solo aparece al ver en USD.
 */
@Component({
  selector: 'app-price-note',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (nota(); as n) {
      <span class="text-xs text-muted">{{ 'currency.reference' | transloco: n }}</span>
    }
  `,
})
export class PriceNote {
  private readonly currency = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;

  protected readonly nota = computed(() => {
    const vigente = this.currency.exchangeRate();
    return this.currency.currency() === 'USD' && vigente ? formatearTc(vigente, this.lang()) : null;
  });
}
