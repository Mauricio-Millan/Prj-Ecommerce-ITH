import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/ui/icon/icon';
import { LanguageSelector } from '../../shared/ui/language-selector/language-selector';

/**
 * Encabezado simplificado del checkout (spec 006, CA-1.4, H8): logo, "Compra segura" y "Volver al carrito", sin buscador, categorías ni moneda.
 * El selector de idioma se queda, discreto. "Volver al carrito" siempre está visible (H3).
 */
@Component({
  selector: 'app-checkout-layout',
  imports: [RouterOutlet, RouterLink, TranslocoPipe, Icon, LanguageSelector],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-surface-muted' },
  template: `
    <header class="border-b border-border bg-surface">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <a routerLink="/" class="text-xl font-bold tracking-tight text-primary" data-track="logo.inicio">TechSuply</a>
        <p class="flex items-center gap-1 text-sm font-medium text-success"><app-icon name="candado" [size]="16" /> {{ 'checkout.secure' | transloco }}</p>
        <a routerLink="/carrito" data-track="checkout.volver-carrito" class="ml-auto inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <app-icon name="volver" [size]="18" /> {{ 'checkout.backToCart' | transloco }}
        </a>
        <app-language-selector />
      </div>
    </header>
    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6"><router-outlet /></main>
  `,
})
export class CheckoutLayout {}
