import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export interface DatosConfirmacion {
  tituloClave: string;
  mensajeClave: string;
  params?: Record<string, unknown>;
  confirmarClave: string;
}

/**
 * Confirmación para acciones que afectan a TODO (vaciar el carrito, CA-3.4). El botón destructivo va separado del de cancelar y el foco
 * empieza en cancelar (H5). Cierra con ✕, Esc y clic fuera (resultado `false`). Raíz con `data-modal="confirmar-eliminar"`.
 * Se abre con `autoFocus: '[data-cancelar]'`. La reutilizarán otras acciones destructivas.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-modal="confirmar-eliminar" class="w-[min(26rem,92vw)] rounded-card bg-surface shadow-overlay">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="confirmar-titulo" class="text-lg font-semibold">{{ datos.tituloClave | transloco: datos.params }}</h2>
        <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'common.close' | transloco" (click)="ref.close(false)">
          <app-icon name="cerrar" />
        </button>
      </div>
      <p class="p-4 text-sm">{{ datos.mensajeClave | transloco: datos.params }}</p>
      <div class="flex flex-wrap justify-between gap-3 border-t border-border p-3">
        <button type="button" data-cancelar class="min-h-11 flex-1 rounded-control border border-border px-4 font-semibold hover:bg-surface-muted" (click)="ref.close(false)">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="min-h-11 flex-1 rounded-control bg-danger px-4 font-semibold text-primary-foreground hover:opacity-90" (click)="ref.close(true)">{{ datos.confirmarClave | transloco }}</button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly datos = inject<DatosConfirmacion>(DIALOG_DATA);
}
