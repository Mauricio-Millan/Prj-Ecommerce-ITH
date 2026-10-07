import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Analytics } from '../../../core/analytics/analytics';

/**
 * Aviso de cookies de analítica. "Aceptar" y "Rechazar" tienen el mismo peso visual (rechazar no debe costar más
 * que aceptar). No bloquea la página: es un aviso, no un diálogo modal.
 */
@Component({
  selector: 'app-cookie-banner',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (analytics.mostrarAviso()) {
      <section
        class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface p-4 shadow-overlay print:hidden"
        role="region"
        [attr.aria-label]="'cookies.title' | transloco"
      >
        <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="text-sm">
            <h2 class="font-semibold text-foreground">{{ 'cookies.title' | transloco }}</h2>
            <p class="text-muted">{{ 'cookies.body' | transloco }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button type="button" class="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-muted" (click)="analytics.responder('rechazado')">
              {{ 'cookies.reject' | transloco }}
            </button>
            <button type="button" class="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-muted" (click)="analytics.responder('aceptado')">
              {{ 'cookies.accept' | transloco }}
            </button>
          </div>
        </div>
      </section>
    }
  `,
})
export class CookieBanner {
  protected readonly analytics = inject(Analytics);
}
