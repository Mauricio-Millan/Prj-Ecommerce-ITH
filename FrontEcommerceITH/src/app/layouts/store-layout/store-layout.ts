import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Footer } from './footer/footer';
import { Header } from './header/header';

@Component({
  selector: 'app-store-layout',
  imports: [RouterOutlet, TranslocoPipe, Header, Footer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col' },
  template: `
    <!-- Con <base href="/">, un href="#contenido" navegaría al inicio: se mueve el foco a mano. -->
    <a
      href="#contenido"
      class="print:hidden sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      (click)="$event.preventDefault(); main.focus()"
    >{{ 'app.skipToContent' | transloco }}</a>
    <app-header />
    <main #main id="contenido" tabindex="-1" class="flex-1 outline-none">
      <router-outlet />
    </main>
    <app-footer />
  `,
})
export class StoreLayout {}
