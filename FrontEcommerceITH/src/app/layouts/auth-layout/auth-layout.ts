import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/ui/icon/icon';
import { LanguageSelector } from '../../shared/ui/language-selector/language-selector';

/** Pantalla limpia: sin buscador ni categorías, con una salida visible a la tienda (CA-1.2, H3, H8). */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, TranslocoPipe, Icon, LanguageSelector],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-surface-muted' },
  template: `
    <header class="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
      <a routerLink="/" class="text-xl font-bold tracking-tight text-primary">TechSuply</a>
      <app-language-selector />
    </header>
    <main class="mx-auto w-full max-w-md flex-1 px-4">
      <a routerLink="/" class="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline" data-track="cuenta.volver-tienda">
        <app-icon name="volver" [size]="18" /> {{ 'auth.backToStore' | transloco }}
      </a>
      <div class="rounded-card bg-surface p-6 shadow-card">
        <router-outlet />
      </div>
    </main>
  `,
})
export class AuthLayout {}
