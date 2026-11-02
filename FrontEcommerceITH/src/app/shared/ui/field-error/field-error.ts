import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

/**
 * Mensaje bajo el campo con ícono y la solución (H4, H9). El campo lo asocia con `aria-describedby="<errorId>"`.
 * Recibe el CÓDIGO del error (la clave es `validation.<codigo>`). Si además recibe el `campo` y el error es "requerido",
 * usa el mensaje propio del campo (`validation.requerido.<campo>`, spec 017 CA-1.1). El contenido proyectado va al final (por ejemplo, un enlace).
 */
@Component({
  selector: 'app-field-error',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (clave(); as k) {
      <p [id]="errorId()" class="mt-1 flex items-start gap-1.5 text-sm font-medium text-danger">
        <app-icon name="advertencia" [size]="16" class="mt-0.5" />
        <span>{{ k | transloco }} <ng-content /></span>
      </p>
    }
  `,
})
export class FieldError {
  readonly errorId = input.required<string>();
  readonly codigo = input<string | null>(null);
  readonly campo = input<string | null>(null);

  protected readonly clave = computed(() => {
    const c = this.codigo();
    if (!c) return null;
    return c === 'required' && this.campo() ? `validation.requerido.${this.campo()}` : `validation.${c}`;
  });
}
