import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface OpcionDireccion {
  id: string;
  /** Texto ya armado: "Av. Larco 123, Miraflores, Lima". */
  texto: string;
  destinatario: string;
  principal: boolean;
}

/** Direcciones guardadas como opciones, con la principal preseleccionada, y "Usar otra dirección" (spec 006, CA-2.1, H6, H7). */
@Component({
  selector: 'app-address-picker',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="grid gap-2 border-0 p-0">
      <legend class="mb-1 text-sm font-semibold">{{ 'checkout.savedAddresses' | transloco }}</legend>
      @for (d of direcciones(); track d.id) {
        <label class="flex min-h-14 cursor-pointer items-start gap-3 rounded-card border bg-surface p-3 text-sm" [class.border-primary]="seleccion() === d.id" [class.border-border]="seleccion() !== d.id">
          <input type="radio" name="direccion" class="mt-1 size-5 accent-primary" data-track="checkout.direccion-guardada" [checked]="seleccion() === d.id" (change)="seleccionar.emit(d.id)" />
          <span>
            <span class="block font-medium">{{ d.destinatario }} @if (d.principal) { <span class="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs">{{ 'checkout.mainAddress' | transloco }}</span> }</span>
            <span class="block text-muted">{{ d.texto }}</span>
          </span>
        </label>
      }
      <label class="flex min-h-14 cursor-pointer items-center gap-3 rounded-card border bg-surface p-3 text-sm font-medium" [class.border-primary]="seleccion() === 'nueva'" [class.border-border]="seleccion() !== 'nueva'">
        <input type="radio" name="direccion" class="size-5 accent-primary" data-track="checkout.nueva-direccion" [checked]="seleccion() === 'nueva'" (change)="seleccionar.emit('nueva')" />
        {{ 'checkout.useOther' | transloco }}
      </label>
    </fieldset>
  `,
})
export class AddressPicker {
  readonly direcciones = input.required<OpcionDireccion[]>();
  /** Id de la guardada elegida, o `nueva`. */
  readonly seleccion = input.required<string>();
  readonly seleccionar = output<string>();
}
