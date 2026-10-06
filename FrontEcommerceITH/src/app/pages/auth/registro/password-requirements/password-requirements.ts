import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { requisitosContrasena } from '../../../../core/validation/validators';
import { Icon } from '../../../../shared/ui/icon/icon';

/** Los 3 requisitos de la contraseña, marcados en tiempo real (CA-2.2, H1, H5, H10). `aria-live="polite"`: el lector anuncia cuando se cumple uno. */
@Component({
  selector: 'app-password-requirements',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul aria-live="polite" class="grid gap-1 text-sm">
      @for (r of items(); track r.clave) {
        <li class="flex items-center gap-2" [class.text-success]="r.cumple" [class.text-muted]="!r.cumple">
          @if (r.cumple) {
            <app-icon name="compatible" [size]="18" />
          } @else {
            <span class="inline-block size-[18px] shrink-0 rounded-full border-2 border-current" aria-hidden="true"></span>
          }
          <span>{{ r.clave | transloco }}</span>
          <span class="sr-only">{{ (r.cumple ? 'auth.req.met' : 'auth.req.pending') | transloco }}</span>
        </li>
      }
    </ul>
  `,
})
export class PasswordRequirements {
  readonly valor = input('');
  protected readonly items = computed(() => {
    const r = requisitosContrasena(this.valor());
    return [
      { clave: 'auth.req.length', cumple: r.largo },
      { clave: 'auth.req.letter', cumple: r.letra },
      { clave: 'auth.req.number', cumple: r.numero },
    ];
  });
}
