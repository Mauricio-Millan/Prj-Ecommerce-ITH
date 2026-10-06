import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetodoPago } from '../../../core/orders/orders.models';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

const OPCIONES: { metodo: MetodoPago; icono: IconName; clave: string }[] = [
  { metodo: 'tarjeta', icono: 'tarjeta', clave: 'payment.card' },
  { metodo: 'yape', icono: 'celular', clave: 'payment.yape.name' },
];

/** Dos medios como opciones grandes (radios con estilo de tarjeta): ícono + nombre, nunca solo color (spec 006, CA-4.0). */
@Component({
  selector: 'app-payment-method',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="grid gap-2 border-0 p-0 sm:grid-cols-2">
      <legend class="mb-2 text-sm font-semibold">{{ 'payment.method' | transloco }}</legend>
      @for (o of opciones; track o.metodo) {
        <label class="flex min-h-16 cursor-pointer items-center gap-3 rounded-card border-2 bg-surface p-3 font-medium" [class.border-primary]="metodo() === o.metodo" [class.border-border]="metodo() !== o.metodo" [class.opacity-60]="deshabilitado()">
          <input type="radio" name="metodo-pago" class="size-5 accent-primary" [attr.data-track]="'checkout.metodo-' + o.metodo" [checked]="metodo() === o.metodo" [disabled]="deshabilitado()" (change)="cambiar.emit(o.metodo)" />
          <app-icon [name]="o.icono" [size]="24" />
          {{ o.clave | transloco }}
        </label>
      }
    </fieldset>
  `,
})
export class PaymentMethod {
  readonly metodo = input.required<MetodoPago>();
  /** No se puede cambiar de medio mientras se procesa el pago (CA-4.4). */
  readonly deshabilitado = input(false);
  readonly cambiar = output<MetodoPago>();
  protected readonly opciones = OPCIONES;
}
