import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TIENDA } from '../../../../core/config/tienda';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Pedido } from '../../../../core/orders/orders.models';
import { formatear } from '../../../../shared/ui/price/price';

/**
 * Boleta imprimible (spec 007, CA-5.1): solo existe al imprimir (`hidden print:block`), sin menús ni botones (H8). Datos de la tienda
 * ficticios y marcada como "simulada". Desde la vista de impresión del navegador se puede guardar como PDF.
 */
@Component({
  selector: 'app-boleta-print',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block' },
  template: `
    <article class="mx-auto max-w-xl bg-surface p-6 text-sm text-foreground">
      <header class="border-b border-foreground pb-3 text-center">
        <p class="text-base font-bold">{{ tienda.razonSocial }}</p>
        <p>RUC {{ tienda.ruc }}</p>
        <p>{{ tienda.direccion }}</p>
        <p class="mt-1 text-xs italic">{{ 'orders.receipt.fictional' | transloco }}</p>
        <h1 class="mt-3 text-lg font-bold">{{ 'orders.receipt.title' | transloco }}</h1>
        <p>{{ 'orders.receipt.number' | transloco }} {{ pedido().codigo }}</p>
      </header>

      <dl class="grid gap-1 border-b border-foreground py-3">
        <div class="flex justify-between"><dt>{{ 'orders.receipt.date' | transloco }}</dt><dd>{{ fecha() }}</dd></div>
        <div class="flex justify-between"><dt>{{ 'orders.receipt.holder' | transloco }}</dt><dd>{{ pedido().comprobante_nombre }}</dd></div>
        <div class="flex justify-between"><dt>DNI</dt><dd>{{ pedido().comprobante_dni }}</dd></div>
        <div class="flex justify-between"><dt>{{ 'orders.receipt.payment' | transloco }}</dt><dd>{{ medio() | transloco }}</dd></div>
      </dl>

      <table class="my-3 w-full">
        <thead>
          <tr class="border-b border-foreground text-left">
            <th class="py-1">{{ 'orders.receipt.product' | transloco }}</th>
            <th class="py-1 text-right">{{ 'orders.receipt.qty' | transloco }}</th>
            <th class="py-1 text-right">{{ 'orders.receipt.unit' | transloco }}</th>
            <th class="py-1 text-right">{{ 'orders.receipt.subtotal' | transloco }}</th>
          </tr>
        </thead>
        <tbody>
          @for (i of pedido().items; track i.sku) {
            <tr>
              <td class="py-1 pr-2">{{ i.nombre_producto }}</td>
              <td class="py-1 text-right tabular-nums">{{ i.cantidad }}</td>
              <td class="py-1 text-right tabular-nums">{{ soles(i.precio_unitario_pen_centimos) }}</td>
              <td class="py-1 text-right tabular-nums">{{ soles(i.subtotal_pen_centimos) }}</td>
            </tr>
          }
        </tbody>
      </table>

      <dl class="grid gap-1 border-t border-foreground pt-3">
        <div class="flex justify-between"><dt>{{ 'checkout.opGravada' | transloco }}</dt><dd class="tabular-nums">{{ soles(pedido().op_gravada_pen_centimos) }}</dd></div>
        <div class="flex justify-between"><dt>{{ 'checkout.igv' | transloco }}</dt><dd class="tabular-nums">{{ soles(pedido().igv_pen_centimos) }}</dd></div>
        <div class="flex justify-between text-base font-bold"><dt>{{ 'orders.receipt.total' | transloco }}</dt><dd class="tabular-nums">{{ soles(pedido().total_pen_centimos) }}</dd></div>
      </dl>
    </article>
  `,
})
export class BoletaPrint {
  readonly pedido = input.required<Pedido>();
  protected readonly tienda = TIENDA;
  private readonly lang = inject(LanguageService).lang;

  protected readonly soles = (c: number) => formatear(c, 'PEN', this.lang());
  protected readonly fecha = computed(() => new Intl.DateTimeFormat(this.lang() === 'qu-PE' ? 'es-PE' : this.lang(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(this.pedido().created_at)));
  protected readonly medio = computed(() => (this.pedido().pagos.find((p) => p.resultado === 'aprobado')?.metodo === 'yape' ? 'payment.yape.name' : 'order.card'));
}
