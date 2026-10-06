import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { cambiosDe, codigoDeError } from '../../../core/validation/form-state';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';

/**
 * Datos para la boleta (spec 006, CA-2.7–2.9). La boleta sale SIEMPRE a nombre del titular de la cuenta, no de quien recibe el envío.
 * Con DNI guardado aparece precargado y solo se edita si el cliente lo pide ("Editar"); sin DNI es un campo obligatorio.
 * El control de la página ya trae el DNI guardado, así que su validez cubre los dos casos.
 */
@Component({
  selector: 'app-boleta-data',
  imports: [ReactiveFormsModule, TranslocoPipe, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section data-zone="formulario-checkout" class="grid gap-3" aria-labelledby="boleta-titulo">
      <h3 id="boleta-titulo" class="text-sm font-semibold">{{ 'checkout.receiptData' | transloco }}</h3>
      <p class="text-sm">{{ 'checkout.holder' | transloco }}: <span class="font-medium">{{ titular() }}</span></p>

      @if (mostrarCampo()) {
        <div>
          <label for="boleta-dni" class="mb-1 block text-sm font-semibold">{{ 'checkout.dni' | transloco }}</label>
          <input
            id="boleta-dni"
            type="text"
            inputmode="numeric"
            maxlength="8"
            autocomplete="off"
            [formControl]="control()"
            [class]="err() ? campoError : campo"
            [attr.aria-invalid]="err() ? 'true' : null"
            [attr.aria-describedby]="err() ? 'boleta-dni-error boleta-dni-nota' : 'boleta-dni-nota'"
          />
          <app-field-error errorId="boleta-dni-error" [codigo]="err()" />
          @if (!dniGuardado()) {
            <p id="boleta-dni-nota" class="mt-1 text-xs text-muted">{{ 'checkout.dniNote' | transloco }}</p>
          } @else {
            <p id="boleta-dni-nota" class="sr-only">{{ 'checkout.dniNote' | transloco }}</p>
          }
        </div>
      } @else {
        <p class="flex flex-wrap items-center gap-2 text-sm">
          {{ 'checkout.dni' | transloco }}: <span class="font-medium tabular-nums">{{ control().value }}</span>
          <button type="button" data-track="checkout.editar-dni" class="min-h-11 rounded-control px-2 font-semibold text-primary underline" (click)="editar()">{{ 'checkout.edit' | transloco }}</button>
        </p>
      }
      <p class="text-xs text-muted">{{ 'checkout.receiptNote' | transloco }}</p>
    </section>
  `,
})
export class BoletaData {
  readonly titular = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  /** El DNI que ya tenía la cuenta (o `null`): decide si se muestra precargado o como campo obligatorio. */
  readonly dniGuardado = input<string | null>(null);
  readonly intentado = input(false);

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;
  private readonly document = inject(DOCUMENT);
  private readonly version = cambiosDe(this.control);
  private readonly editando = signal(false);

  protected readonly mostrarCampo = computed(() => !this.dniGuardado() || this.editando() || this.control().invalid);
  protected readonly err = computed(() => (this.version(), codigoDeError(this.control(), this.intentado())));

  protected editar(): void {
    this.editando.set(true);
    setTimeout(() => this.document.getElementById('boleta-dni')?.focus());
  }
}
