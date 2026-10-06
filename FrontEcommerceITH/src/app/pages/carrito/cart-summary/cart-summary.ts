import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ResumenCarrito } from '../../../core/cart/cart.models';
import { Moneda } from '../../../core/currency/currency.service';
import { TipoCambio } from '../../../core/currency/exchange-rate.api';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { formatear, formatearTc } from '../../../shared/ui/price/price';

/**
 * Resumen del carrito (spec 005, CA-1.2, 1.3, 4.3). El total del carrito ES el total a pagar: envío incluido e IGV incluido, sin líneas
 * que se sumen. "Continuar al pago" deshabilitado muestra SIEMPRE su motivo al lado (H1, H5, H9). En el celular, el total y el botón
 * quedan fijos abajo (Fitts); en escritorio, el bloque entero queda a la vista mientras se baja.
 */
@Component({
  selector: 'app-cart-summary',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section data-zone="resumen-pedido" [attr.aria-labelledby]="'resumen-titulo'" class="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-card lg:sticky lg:top-32">
      <h2 id="resumen-titulo" class="text-lg font-semibold">{{ 'cart.summary' | transloco }}</h2>
      <p class="text-sm">{{ (resumen().unidades === 1 ? 'cart.unitsOne' : 'cart.units') | transloco: { n: resumen().unidades } }}</p>
      @if (tc()) {
        <p class="text-sm text-muted">{{ 'cart.exchangeRate' | transloco: { tc: tcTexto() } }}</p>
      }
      <p class="text-sm text-muted">{{ 'currency.igvIncluded' | transloco }}</p>
      <p class="flex items-center gap-2 text-sm text-muted"><app-icon name="envio" [size]="16" /> {{ 'shipping.included' | transloco }}</p>

      <!-- Total y botón: fijos abajo en el celular, dentro del bloque en escritorio. -->
      <div class="fixed inset-x-0 bottom-0 z-20 grid gap-2 border-t border-border bg-surface p-3 shadow-overlay lg:static lg:z-auto lg:border-0 lg:p-0 lg:shadow-none">
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-semibold">{{ 'cart.total' | transloco }}</span>
          <span class="text-xl font-bold tabular-nums">{{ total() }}</span>
        </div>
        @if (pagarasEnSoles(); as pen) {
          <p class="text-sm text-muted">{{ 'cart.youPay' | transloco: { monto: pen } }}</p>
        }
        <button
          type="button"
          data-zone="cta-principal"
          data-track="cta-principal.continuar-pago"
          class="min-h-12 rounded-control bg-accent px-4 font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
          [disabled]="!resumen().puedePagar"
          [attr.aria-describedby]="resumen().motivo ? 'motivo-pago' : null"
          (click)="continuar.emit()"
        >{{ 'cart.continue' | transloco }}</button>

        @if (resumen().motivo === 'agotados') {
          <button id="motivo-pago" type="button" class="min-h-11 text-left text-sm font-medium text-danger underline" (click)="irAAgotado.emit()">
            {{ 'cart.reasonSoldOut' | transloco: { n: resumen().agotados } }}
          </button>
        } @else if (resumen().motivo === 'sin-tc') {
          <p id="motivo-pago" role="status" class="text-sm font-medium text-danger">{{ 'cart.reasonNoRate' | transloco }}</p>
        }
      </div>
    </section>
  `,
})
export class CartSummary {
  readonly resumen = input.required<ResumenCarrito>();
  readonly moneda = input.required<Moneda>();
  readonly tc = input<TipoCambio | null>(null);
  readonly continuar = output<void>();
  readonly irAAgotado = output<void>();

  private readonly lang = inject(LanguageService).lang;
  protected readonly tcTexto = computed(() => (this.tc() ? formatearTc(this.tc()!, this.lang()).tc : ''));

  /** El total en la moneda que se ve; en USD es solo referencia (H1, H2). */
  readonly total = computed(() =>
    this.moneda() === 'PEN' ? formatear(this.resumen().totalPenCentimos, 'PEN', this.lang()) : formatear(this.resumen().totalUsdCentimos, 'USD', this.lang()),
  );
  /** "Pagarás S/ …": el monto real cuando se ven USD, porque el pago siempre es en soles (CA-1.3b). */
  protected readonly pagarasEnSoles = computed(() =>
    this.moneda() === 'USD' && this.tc() && this.resumen().totalPenCentimos > 0 ? formatear(this.resumen().totalPenCentimos, 'PEN', this.lang()) : null,
  );
}
