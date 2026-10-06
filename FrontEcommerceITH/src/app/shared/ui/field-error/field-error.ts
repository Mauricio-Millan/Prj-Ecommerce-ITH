import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

/**
 * Mensaje bajo el campo con ícono y la solución (H4, H9). El campo lo asocia con `aria-describedby="<errorId>"`.
 * Recibe el CÓDIGO del error (la clave es `validation.<codigo>`); el contenido proyectado va al final (por ejemplo, un enlace).
 */
@Component({
  selector: 'app-field-error',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (codigo(); as c) {
      <p [id]="errorId()" class="mt-1 flex items-start gap-1.5 text-sm font-medium text-danger">
        <app-icon name="advertencia" [size]="16" class="mt-0.5" />
        <span>{{ 'validation.' + c | transloco }} <ng-content /></span>
      </p>
    }
  `,
})
export class FieldError {
  readonly errorId = input.required<string>();
  readonly codigo = input<string | null>(null);
}
