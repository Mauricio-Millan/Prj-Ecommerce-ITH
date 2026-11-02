import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Dialog } from '@angular/cdk/dialog';
import { Analytics } from '../../../core/analytics/analytics';
import { CurrencyService } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { A11yPanel } from '../../../shared/ui/a11y-panel/a11y-panel';
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
      <nav class="flex flex-wrap gap-y-1" [attr.aria-label]="'footer.nav' | transloco">
        <a routerLink="/" class="underline-offset-4 hover:underline">{{ 'footer.home' | transloco }}</a>
        <a routerLink="/ayuda" fragment="contacto" class="ml-4 underline-offset-4 hover:underline">{{ 'footer.help' | transloco }}</a>
        <a routerLink="/ayuda" fragment="garantia" class="ml-4 underline-offset-4 hover:underline">{{ 'footer.warranty' | transloco }}</a>
        <a routerLink="/ayuda" fragment="compatibilidad" class="ml-4 underline-offset-4 hover:underline">{{ 'footer.compat' | transloco }}</a>
        <button type="button" data-zone="accesibilidad" data-track="accesibilidad.abrir" class="ml-4 underline-offset-4 hover:underline" (click)="abrirAccesibilidad()">{{ 'footer.accessibility' | transloco }}</button>
        @if (analytics.disponible) {
          <button type="button" class="ml-4 underline-offset-4 hover:underline" (click)="analytics.reabrir()">{{ 'cookies.preferences' | transloco }}</button>
        }
      </nav>
      <p>{{ 'footer.rights' | transloco }}</p>
    </div>
  `,
})
export class Footer {
  protected readonly analytics = inject(Analytics);
  private readonly dialog = inject(Dialog);
  private readonly currency = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;

  protected readonly tc = computed(() => {
    const vigente = this.currency.exchangeRate();
    return vigente ? formatearTc(vigente, this.lang()) : null;
  });

  protected abrirAccesibilidad(): void {
    this.dialog.open(A11yPanel, { ariaLabelledBy: 'a11y-titulo' });
  }
}
