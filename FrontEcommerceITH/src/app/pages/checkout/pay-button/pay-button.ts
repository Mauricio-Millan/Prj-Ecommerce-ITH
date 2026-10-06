import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetodoPago } from '../../../core/orders/orders.models';

/**
 * "Pagar S/ 742.50" o "Pagar S/ 742.50 con Yape" con el monto exacto (H1). Al procesar se deshabilita, dice "Procesando pago…" y marca
 * `aria-busy`: no se puede enviar dos veces (spec 006, CA-4.3, 4.4). En el celular queda fijo abajo (CA-3.5).
 */
@Component({
  selector: 'app-pay-button',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface p-3 shadow-overlay lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <button
        type="button"
        data-zone="cta-principal"
        data-track="cta-principal.pagar"
        class="flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        [disabled]="procesando()"
        [attr.aria-busy]="procesando()"
        (click)="pagar.emit()"
      >
        @if (procesando()) {
          <span class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>
          {{ 'payment.processing' | transloco }}
        } @else {
          {{ (metodo() === 'yape' ? 'payment.payWithYape' : 'payment.pay') | transloco: { monto: monto() } }}
        }
      </button>
    </div>
  `,
})
export class PayButton {
  /** Monto ya formateado en soles. */
  readonly monto = input.required<string>();
  readonly metodo = input.required<MetodoPago>();
  readonly procesando = input(false);
  readonly pagar = output<void>();
}
