import { CdkMenu, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencyService, Moneda } from '../../../core/currency/currency.service';
import { Icon } from '../icon/icon';

const SIMBOLO: Record<Moneda, string> = { PEN: 'S/', USD: '$' };

@Component({
  selector: 'app-currency-selector',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItemRadio, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      data-zone="selector-moneda"
      data-track="selector-moneda.abrir"
      class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-1 text-sm hover:bg-surface-muted sm:px-2"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="('currency.label' | transloco) + ': ' + ('currency.' + currency.currency() | transloco)"
    >
      <span class="font-semibold">{{ simbolo[currency.currency()] }}</span>
      <span class="hidden sm:inline">{{ currency.currency() }}</span>
      <span class="hidden sm:inline-flex"><app-icon name="desplegar" [size]="16" /></span>
    </button>

    <ng-template #menu>
      <div cdkMenu class="w-64 rounded-card border border-border bg-surface p-1 shadow-overlay">
        @for (moneda of monedas; track moneda) {
          <button
            cdkMenuItemRadio
            type="button"
            class="flex min-h-11 w-full flex-col justify-center rounded-control px-3 py-2 text-left text-sm hover:bg-surface-muted focus:bg-surface-muted aria-checked:font-semibold aria-disabled:cursor-not-allowed aria-disabled:text-muted aria-disabled:hover:bg-transparent"
            [attr.data-track]="'selector-moneda.' + moneda"
            [cdkMenuItemChecked]="moneda === currency.currency()"
            [cdkMenuItemDisabled]="moneda === 'PEN' && !currency.penDisponible()"
            (cdkMenuItemTriggered)="currency.setCurrency(moneda)"
          >
            <span>{{ 'currency.' + moneda | transloco }}</span>
            @if (moneda === 'PEN' && !currency.penDisponible()) {
              <span class="text-xs font-normal">{{ 'currency.penUnavailable' | transloco }}</span>
            }
          </button>
        }
        <!-- Se muestra siempre: es lo que el usuario necesita saber antes de elegir (constitución § 3.3). -->
        <p class="border-t border-border px-3 py-2 text-xs text-muted">{{ 'currency.paidInPen' | transloco }}</p>
      </div>
    </ng-template>
  `,
})
export class CurrencySelector {
  protected readonly currency = inject(CurrencyService);
  protected readonly monedas: Moneda[] = ['PEN', 'USD'];
  protected readonly simbolo = SIMBOLO;
}
