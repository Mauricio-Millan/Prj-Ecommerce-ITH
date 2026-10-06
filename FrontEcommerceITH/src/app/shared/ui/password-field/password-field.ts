import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { CAMPO, CAMPO_ERROR } from '../form-classes';

/**
 * Campo de contraseña con "Mostrar / Ocultar" (CA-1.3, H5). Cambia el `type` sin tocar el valor ni el foco: es el mismo `<input>`.
 * Funciona con Reactive Forms (`formControlName`). El `<label for>` lo pone quien lo usa, con el mismo `inputId`.
 */
@Component({
  selector: 'app-password-field',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordField), multi: true }],
  template: `
    <div class="flex gap-2">
      <input
        #campo
        [id]="inputId()"
        [type]="visible() ? 'text' : 'password'"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-describedby]="describedBy() || null"
        [attr.aria-invalid]="conError() ? 'true' : null"
        [class]="conError() ? errorClase : clase"
        [value]="valor()"
        [disabled]="deshabilitado()"
        (input)="alEscribir($any($event.target).value)"
        (blur)="alSalir()"
      />
      <button
        type="button"
        data-track="cuenta.mostrar-contrasena"
        class="min-h-11 min-w-24 rounded-control border border-border px-3 text-sm font-semibold text-primary hover:bg-surface-muted"
        [attr.aria-pressed]="visible()"
        [attr.aria-controls]="inputId()"
        (click)="visible.set(!visible())"
      >{{ (visible() ? 'auth.hide' : 'auth.show') | transloco }}</button>
    </div>
  `,
})
export class PasswordField implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly describedBy = input('');
  readonly conError = input(false);

  protected readonly clase = CAMPO;
  protected readonly errorClase = CAMPO_ERROR;
  protected readonly visible = signal(false);
  protected readonly valor = signal('');
  protected readonly deshabilitado = signal(false);
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  private cambio: (v: string) => void = () => {};
  private tocado: () => void = () => {};

  enfocar(): void {
    this.campo().nativeElement.focus();
  }

  protected alEscribir(v: string): void {
    this.valor.set(v);
    this.cambio(v);
  }

  protected alSalir(): void {
    this.tocado();
  }

  writeValue(v: string | null): void {
    this.valor.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.cambio = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.tocado = fn;
  }
  setDisabledState(d: boolean): void {
    this.deshabilitado.set(d);
  }
}
