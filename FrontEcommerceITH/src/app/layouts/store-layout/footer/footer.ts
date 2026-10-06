import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencyService } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { formatearTc } from '../../../shared/ui/price/price';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-t border-border bg-surface-muted print:hidden' },
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
      <div class="grid gap-1">
        <p class="flex items-center gap-2 font-medium text-foreground">
          <app-icon name="envio" [size]="18" />
          {{ 'shipping.included' | transloco }}
        </p>
        <p>{{ 'currency.igvIncluded' | transloco }}</p>
        <!-- El tipo de cambio y su fecha se informan aquí, no junto a cada precio en soles (CA-3.3 revisado). -->
        @if (tc(); as tc) {
          <p>{{ 'currency.storeRate' | transloco: tc }}</p>
        }
      </div>
      <nav [attr.aria-label]="'footer.nav' | transloco">
        <a routerLink="/" class="underline-offset-4 hover:underline">{{ 'footer.home' | transloco }}</a>
      </nav>
      <p>{{ 'footer.rights' | transloco }}</p>
    </div>
  `,
})
export class Footer {
  private readonly currency = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;

  protected readonly tc = computed(() => {
    const vigente = this.currency.exchangeRate();
    return vigente ? formatearTc(vigente, this.lang()) : null;
  });
}
