import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Moneda } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { Pedido } from '../../../core/orders/orders.models';
import { formatear, formatearTc } from '../price/price';

/**
 * Resumen del pedido (spec 006, CA-3.1–3.3), con los montos FIJOS del pedido en soles. Lo reutilizan la revisión, la confirmación y la 007.
 * El IGV está desglosado como en una boleta (Op. gravada · IGV · Total): el total es la suma de las líneas y el IGV se desglosa desde él.
 * Si se ven USD, el resumen sigue en soles con la nota "El pago se realiza en soles" y los USD solo como referencia (H2).
 */
@Component({
  selector: 'app-order-summary',
  imports: [TranslocoPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section data-zone="resumen-pedido" class="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-card" [attr.aria-label]="'checkout.orderSummary' | transloco">
      <h2 class="text-lg font-semibold">{{ 'checkout.orderSummary' | transloco }}</h2>

      <ul class="grid gap-3">
        @for (i of pedido().items; track i.sku) {
          <li class="flex gap-3">
            <img [src]="i.imagen" alt="" width="56" height="56" class="size-14 shrink-0 rounded-control bg-surface-muted object-cover" />
            <div class="min-w-0 flex-1 text-sm">
              @if (conFicha()?.has(i.sku)) {
                <a [routerLink]="['/producto', i.sku]" class="font-medium text-primary hover:underline">{{ i.nombre_producto }}</a>
              } @else {
                <p class="font-medium">{{ i.nombre_producto }}</p>
              }
              <p class="text-muted">{{ i.cantidad }} × {{ soles(i.precio_unitario_pen_centimos) }}</p>
            </div>
            <p class="text-sm font-semibold tabular-nums">{{ soles(i.subtotal_pen_centimos) }}</p>
          </li>
        }
      </ul>

      @if (mostrarDatos()) {
        <div class="grid gap-2 border-t border-border pt-3 text-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-semibold">{{ 'checkout.shipTo' | transloco }}</p>
              <p>{{ pedido().envio.destinatario }} · {{ pedido().envio.telefono }}</p>
              <p class="text-muted">{{ pedido().envio.direccion }}, {{ pedido().envio.distrito }}, {{ pedido().envio.provincia }}, {{ pedido().envio.departamento }}</p>
            </div>
            @if (editable()) {
              <button type="button" data-track="checkout.editar-envio" class="min-h-11 shrink-0 rounded-control px-2 font-semibold text-primary underline" (click)="cambiar.emit()">{{ 'checkout.change' | transloco }}</button>
            }
          </div>
          <div class="flex items-start justify-between gap-3">
            <p>{{ 'order.receipt' | transloco: { nombre: pedido().comprobante_nombre, dni: pedido().comprobante_dni } }}</p>
            @if (editable()) {
              <button type="button" data-track="checkout.editar-envio" class="min-h-11 shrink-0 rounded-control px-2 font-semibold text-primary underline" (click)="cambiar.emit()">{{ 'checkout.change' | transloco }}</button>
            }
          </div>
        </div>
      }

      <dl class="grid gap-1 border-t border-border pt-3 text-sm">
        <div class="flex justify-between"><dt>{{ 'checkout.opGravada' | transloco }}</dt><dd class="tabular-nums">{{ soles(pedido().op_gravada_pen_centimos) }}</dd></div>
        <div class="flex justify-between"><dt>{{ 'checkout.igv' | transloco }}</dt><dd class="tabular-nums">{{ soles(pedido().igv_pen_centimos) }}</dd></div>
        <div class="flex justify-between"><dt>{{ 'checkout.shipping' | transloco }}</dt><dd>{{ 'checkout.included' | transloco }}</dd></div>
        <div class="mt-1 flex items-baseline justify-between text-base font-bold"><dt>{{ 'cart.total' | transloco }}</dt><dd class="text-xl tabular-nums">{{ soles(pedido().total_pen_centimos) }}</dd></div>
      </dl>

      <div class="grid gap-1 text-xs text-muted">
        <p>{{ 'cart.exchangeRate' | transloco: { tc: tc() } }}</p>
        @if (moneda() === 'USD') {
          <p class="font-medium text-foreground">{{ 'checkout.paidInSoles' | transloco }}</p>
          <p>{{ 'checkout.usdReference' | transloco: { monto: usd() } }}</p>
        }
      </div>
    </section>
  `,
})
export class OrderSummary {
  readonly pedido = input.required<Pedido>();
  /** La moneda con la que el cliente ve la tienda: en USD se agrega la nota y la referencia. */
  readonly moneda = input<Moneda>('PEN');
  /** Con "Cambiar" (paso de pago); en la confirmación y en "Mis pedidos" va sin enlaces. */
  readonly editable = input(false);
  readonly mostrarDatos = input(true);
  /** Skus cuya ficha existe todavía: solo esos nombres llevan enlace (spec 007, CA-2.2). Sin esto, ninguno. */
  readonly conFicha = input<ReadonlySet<string> | null>(null);
  readonly cambiar = output<void>();

  private readonly lang = inject(LanguageService).lang;
  protected readonly soles = (centimos: number) => formatear(centimos, 'PEN', this.lang());
  protected readonly tc = computed(() => formatearTc({ valor: String(this.pedido().tipo_cambio), fecha: this.pedido().created_at }, this.lang()).tc);
  protected readonly usd = computed(() => formatear(this.pedido().total_usd_centimos, 'USD', this.lang()));
}
