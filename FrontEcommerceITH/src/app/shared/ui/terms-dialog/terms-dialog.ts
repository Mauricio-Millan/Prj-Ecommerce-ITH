import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export type TipoTexto = 'terminos' | 'privacidad';

/**
 * Términos y condiciones / Política de privacidad (CA-2.3). Se abren en un diálogo y no en otra pestaña: no se pierde lo escrito y no se
 * confunde al participante. Los textos son de EJEMPLO en la Fase 1. Su raíz lleva `data-modal="terminos"`.
 */
@Component({
  selector: 'app-terms-dialog',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-modal="terminos" class="flex max-h-[85vh] w-[min(36rem,92vw)] flex-col rounded-card bg-surface shadow-overlay">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="terminos-titulo" class="text-lg font-semibold">{{ 'auth.terms.' + tipo + '.title' | transloco }}</h2>
        <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'auth.terms.close' | transloco" (click)="ref.close()">
          <app-icon name="cerrar" />
        </button>
      </div>
      <div class="grid gap-3 overflow-y-auto p-4 text-sm leading-relaxed">
        <p class="rounded-control bg-surface-muted p-2 text-muted">{{ 'auth.terms.sample' | transloco }}</p>
        <p>{{ 'auth.terms.' + tipo + '.body' | transloco }}</p>
      </div>
      <div class="border-t border-border p-3">
        <button type="button" class="min-h-11 w-full rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="ref.close()">{{ 'auth.terms.close' | transloco }}</button>
      </div>
    </div>
  `,
})
export class TermsDialog {
  protected readonly ref = inject(DialogRef);
  protected readonly tipo = inject<TipoTexto>(DIALOG_DATA);
}
