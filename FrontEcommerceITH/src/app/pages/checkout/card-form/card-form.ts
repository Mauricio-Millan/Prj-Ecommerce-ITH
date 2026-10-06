import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { cambiosDe, codigoDeError } from '../../../core/validation/form-state';
import { formatearTarjeta, marcaTarjeta } from '../../../core/validation/validators';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { Icon } from '../../../shared/ui/icon/icon';

/** `1226` → `12/26`: el usuario solo escribe dígitos. */
const formatearVencimiento = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/**
 * Formulario de tarjeta (spec 006, CA-4.1, 4.2). Número con espacios cada 4 dígitos y la marca detectada, vencimiento MM/AA y CVV con ⓘ.
 * Se valida en tiempo real (al salir de cada campo). Nada de esto se guarda: viaja solo hasta el simulador (CA-4.6).
 */
@Component({
  selector: 'app-card-form',
  imports: [ReactiveFormsModule, TranslocoPipe, FieldError, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="formulario-checkout" [formGroup]="form()" class="grid gap-4">
      <div>
        <label for="pago-numero" class="mb-1 block text-sm font-semibold">{{ 'payment.cardNumber' | transloco }}</label>
        <div class="relative">
          <input id="pago-numero" type="text" inputmode="numeric" autocomplete="cc-number" maxlength="23" formControlName="numero" [class]="clase('numero')" [attr.aria-describedby]="err('numero') ? 'pago-numero-error' : null" (input)="formatearNumero($event)" />
          <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-sm text-muted">
            <app-icon name="tarjeta" [size]="18" />
            @if (marca(); as m) { {{ 'payment.brand.' + m | transloco }} }
          </span>
        </div>
        <app-field-error errorId="pago-numero-error" [codigo]="err('numero')" />
      </div>

      <div>
        <label for="pago-titular" class="mb-1 block text-sm font-semibold">{{ 'payment.cardHolder' | transloco }}</label>
        <input id="pago-titular" type="text" autocomplete="cc-name" formControlName="titular" [class]="clase('titular')" [attr.aria-describedby]="err('titular') ? 'pago-titular-error' : null" />
        <app-field-error errorId="pago-titular-error" [codigo]="err('titular')" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="pago-vencimiento" class="mb-1 block text-sm font-semibold">{{ 'payment.expiry' | transloco }}</label>
          <input id="pago-vencimiento" type="text" inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="MM/AA" formControlName="vencimiento" [class]="clase('vencimiento')" [attr.aria-describedby]="err('vencimiento') ? 'pago-vencimiento-error' : null" (input)="formatearFecha($event)" />
          <app-field-error errorId="pago-vencimiento-error" [codigo]="err('vencimiento')" />
        </div>
        <div>
          <label for="pago-cvv" class="mb-1 flex items-center justify-between text-sm font-semibold">
            {{ 'payment.cvv' | transloco }}
            <!-- 44 px de área táctil sin estirar la etiqueta: el margen negativo la compensa. -->
            <button type="button" class="-my-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted hover:bg-surface-muted" [attr.aria-label]="'payment.cvvHelpLabel' | transloco" [attr.aria-expanded]="ayudaCvv()" aria-controls="pago-cvv-ayuda" (click)="ayudaCvv.set(!ayudaCvv())">
              <app-icon name="info" [size]="18" />
            </button>
          </label>
          <input id="pago-cvv" type="text" inputmode="numeric" autocomplete="cc-csc" maxlength="3" formControlName="cvv" [class]="clase('cvv')" [attr.aria-describedby]="err('cvv') ? 'pago-cvv-error' : null" />
          <app-field-error errorId="pago-cvv-error" [codigo]="err('cvv')" />
        </div>
      </div>
      @if (ayudaCvv()) {
        <p id="pago-cvv-ayuda" class="rounded-control bg-surface-muted p-2 text-xs text-muted">{{ 'payment.cvvHelp' | transloco }}</p>
      }
    </div>
  `,
})
export class CardForm {
  readonly form = input.required<FormGroup>();
  readonly intentado = input(false);

  protected readonly ayudaCvv = signal(false);
  private readonly version = cambiosDe(this.form);
  protected readonly marca = computed(() => (this.version(), marcaTarjeta(this.form().value.numero ?? '')));

  protected err(nombre: string): string | null {
    this.version();
    return codigoDeError(this.form().controls[nombre], this.intentado());
  }

  protected clase(nombre: string): string {
    return this.err(nombre) ? CAMPO_ERROR : CAMPO;
  }

  protected formatearNumero(e: Event): void {
    const campo = e.target as HTMLInputElement;
    const f = formatearTarjeta(campo.value);
    campo.value = f;
    this.form().controls['numero'].setValue(f);
  }

  protected formatearFecha(e: Event): void {
    const campo = e.target as HTMLInputElement;
    const f = formatearVencimiento(campo.value);
    campo.value = f;
    this.form().controls['vencimiento'].setValue(f);
  }
}
