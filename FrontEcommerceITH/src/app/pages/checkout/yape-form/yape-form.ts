import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { cambiosDe, codigoDeError } from '../../../core/validation/form-state';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Yape simulado (spec 006, CA-4.Y1–4.Y3): instrucciones en 2 pasos, celular registrado en Yape y código de aprobación de 6 dígitos.
 * Se recuerda que el código vence en pocos minutos (H10). El celular y el código NUNCA se guardan (CA-4.6).
 */
@Component({
  selector: 'app-yape-form',
  imports: [ReactiveFormsModule, TranslocoPipe, FieldError, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="formulario-checkout" [formGroup]="form()" class="grid gap-4">
      <div class="flex gap-3 rounded-card bg-surface-muted p-3 text-sm">
        <app-icon name="celular" [size]="24" class="text-primary" />
        <ol class="grid list-decimal gap-1 pl-4">
          <li>{{ 'payment.yape.step1' | transloco }}</li>
          <li>{{ 'payment.yape.step2' | transloco }}</li>
        </ol>
      </div>

      <div>
        <label for="pago-yape-celular" class="mb-1 block text-sm font-semibold">{{ 'payment.yape.phone' | transloco }}</label>
        <input id="pago-yape-celular" type="tel" inputmode="numeric" maxlength="9" autocomplete="tel" formControlName="celular" [class]="clase('celular')" [attr.aria-describedby]="err('celular') ? 'pago-yape-celular-error' : null" />
        <app-field-error errorId="pago-yape-celular-error" [codigo]="err('celular')" />
      </div>

      <div>
        <label for="pago-yape-codigo" class="mb-1 block text-sm font-semibold">{{ 'payment.yape.code' | transloco }}</label>
        <input id="pago-yape-codigo" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="codigo" [class]="clase('codigo')" [attr.aria-describedby]="(err('codigo') ? 'pago-yape-codigo-error ' : '') + 'pago-yape-vence'" />
        <app-field-error errorId="pago-yape-codigo-error" [codigo]="err('codigo')" />
        <p id="pago-yape-vence" class="mt-1 text-xs text-muted">{{ 'payment.yape.expires' | transloco }}</p>
      </div>
    </div>
  `,
})
export class YapeForm {
  readonly form = input.required<FormGroup>();
  readonly intentado = input(false);
  private readonly version = cambiosDe(this.form);

  protected err(nombre: string): string | null {
    this.version();
    return codigoDeError(this.form().controls[nombre], this.intentado());
  }

  protected clase(nombre: string): string {
    return this.err(nombre) ? CAMPO_ERROR : CAMPO;
  }
}
