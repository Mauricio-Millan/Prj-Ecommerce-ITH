import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Obligatoriedad } from '../../../core/builder/builder.models';
import { PasoId } from '../../../core/builder/pasos';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Cabecera de cada paso (spec 008, CA-1.2, 1.3, 2.2): nombre con ⓘ en lenguaje simple, "Obligatorio" u "Opcional" con su motivo y
 * "Mostrando placas compatibles con tu Ryzen 5 7600" para explicar por qué se ve lo que se ve (H1, H2, H10). Recibe el foco al cambiar de paso.
 */
@Component({
  selector: 'app-step-header',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-2">
      <h2 id="armador-titulo" tabindex="-1" class="flex items-center gap-1 text-xl font-bold outline-none">
        {{ 'builder.step.' + paso() | transloco }}
        <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted hover:bg-surface-muted" [attr.aria-label]="'builder.helpLabel' | transloco" [attr.aria-expanded]="ayuda()" aria-controls="armador-ayuda" (click)="ayuda.set(!ayuda())">
          <app-icon name="info" [size]="18" />
        </button>
      </h2>
      @if (ayuda()) {
        <p id="armador-ayuda" class="rounded-control bg-surface-muted p-2 text-sm text-muted">{{ 'builder.help.' + paso() | transloco }}</p>
      }
      <p class="text-sm">
        <span class="font-semibold" [class.text-danger]="obligatoriedad().obligatorio">{{ (obligatoriedad().obligatorio ? 'builder.required' : 'builder.optional') | transloco }}</span>
        @if (obligatoriedad().motivo; as m) { · <span class="text-muted">{{ 'builder.reason.' + m | transloco }}</span> }
      </p>
      @if (relacionadas().length) {
        <p class="text-sm text-muted">{{ 'builder.showing' | transloco: { piezas: ('builder.plural.' + paso() | transloco), nombres: nombres() } }}</p>
      }
    </div>
  `,
})
export class StepHeader {
  readonly paso = input.required<PasoId>();
  readonly obligatoriedad = input.required<Obligatoriedad>();
  /** Nombres de las piezas ya elegidas con las que este paso debe calzar. */
  readonly relacionadas = input<string[]>([]);
  protected readonly ayuda = signal(false);
  protected readonly nombres = computed(() => this.relacionadas().join(', '));
}
