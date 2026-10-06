import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LogoutService } from '../../core/auth/logout.service';
import { SessionApi } from '../../core/auth/session.api';
import { Icon } from '../../shared/ui/icon/icon';
import { LanguageSelector } from '../../shared/ui/language-selector/language-selector';

/** Barra lateral de gestión + topbar + "Volver a la tienda" (CA-1.3). Las secciones se agregan con las specs 009 y 010. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, Icon, LanguageSelector],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col md:flex-row' },
  template: `
    <aside class="border-b border-border bg-surface-muted md:w-60 md:border-r md:border-b-0">
      <a routerLink="/admin" class="block px-4 py-4 text-xl font-bold tracking-tight text-primary">TechSuply</a>
      <nav [attr.aria-label]="'admin.nav' | transloco">
        <ul class="flex gap-1 px-2 pb-2 md:flex-col">
          <li>
            <a
              routerLink="/admin"
              routerLinkActive="bg-surface font-semibold text-primary"
              [routerLinkActiveOptions]="{ exact: true }"
              class="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-surface"
            >
              <app-icon name="panel" [size]="18" /> {{ 'admin.dashboard' | transloco }}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
    <div class="flex flex-1 flex-col">
      <header class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <a routerLink="/" class="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline" data-track="admin.volver-tienda">
          <app-icon name="volver" [size]="18" /> {{ 'admin.backToStore' | transloco }}
        </a>
        <div class="ml-auto flex items-center gap-2">
          <app-language-selector />
          <span class="hidden text-sm text-muted sm:inline">{{ session.usuario()?.email }}</span>
          <button type="button" class="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-surface-muted" (click)="salir()">
            <app-icon name="salir" [size]="18" /> {{ 'header.logout' | transloco }}
          </button>
        </div>
      </header>
      <main class="flex-1 p-4 md:p-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminLayout {
  protected readonly session = inject(SessionApi);
  private readonly logout = inject(LogoutService);

  protected salir(): void {
    this.logout.cerrar();
  }
}
