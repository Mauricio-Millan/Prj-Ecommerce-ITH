import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
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
        #aviso
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
  private readonly aviso = viewChild<ElementRef<HTMLElement>>('aviso');

  constructor() {
    // Mientras el aviso está abierto, la página reserva su alto abajo (`scroll-padding-bottom` en styles.css):
    // así ningún elemento enfocado queda tapado por él (WCAG 2.4.11, 013 CA-1.8).
    const raiz = inject(DOCUMENT).documentElement.style;
    effect((alLimpiar) => {
      const el = this.aviso()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const medir = new ResizeObserver(() => raiz.setProperty('--alto-aviso', `${el.offsetHeight}px`));
      medir.observe(el);
      alLimpiar(() => {
        medir.disconnect();
        raiz.removeProperty('--alto-aviso');
      });
    });
  }
}
