import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LineaDetalle } from '../../../core/cart/cart.models';
import { Moneda } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { formatear } from '../../../shared/ui/price/price';
import { QuantityInput } from '../../../shared/ui/quantity-input/quantity-input';

/**
 * Una línea del carrito (spec 005, HU-1 a HU-4). Presentación pura: recibe la línea ya calculada en céntimos y emite lo que el usuario hace.
 * Agotada → atenuada, sin cantidad, con "Eliminar" destacado (CA-4.2). Ajustada → dice cuántas quedan (CA-4.1).
 */
@Component({
  selector: 'app-cart-line',
  imports: [RouterLink, TranslocoPipe, Icon, QuantityInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div data-zone="linea-carrito" class="flex gap-3 rounded-card border border-border bg-surface p-3 shadow-card" [class.opacity-70]="agotada()">
      <a [routerLink]="['/producto', producto().sku]" data-track="linea-carrito.abrir" tabindex="-1" aria-hidden="true" class="shrink-0">
        <img [src]="producto().imagenes[0]?.url ?? ''" alt="" width="96" height="96" class="size-20 rounded-control bg-surface-muted object-cover sm:size-24" />
      </a>

      <div class="grid min-w-0 flex-1 gap-2">
        <h3 class="font-medium">
          <a [id]="'linea-' + producto().sku" [routerLink]="['/producto', producto().sku]" data-track="linea-carrito.abrir" class="hover:underline">{{ producto().nombre }}</a>
        </h3>
        <p data-zone="precio" class="text-sm text-muted">{{ unitario() }}</p>

        @if (agotada()) {
          <p class="flex items-center gap-1 text-sm font-semibold text-danger"><app-icon name="agotado" [size]="16" /> {{ 'cart.soldOut' | transloco }}</p>
        } @else if (detalle().estado === 'ajustado') {
          <p role="status" class="flex items-center gap-1 text-sm font-medium text-warning"><app-icon name="advertencia" [size]="16" /> {{ 'cart.adjusted' | transloco: { n: producto().stock } }}</p>
        }

        <div class="flex flex-wrap items-center justify-between gap-3">
          @if (!agotada()) {
            <app-quantity-input [max]="producto().stock" [valor]="detalle().linea.cantidad" [etiqueta]="producto().nombre" seguimiento="linea-carrito" (valorChange)="cambiar.emit($event)" />
            <p class="font-semibold tabular-nums">{{ subtotal() }}</p>
          }
          <button
            type="button"
            [id]="'eliminar-' + producto().sku"
            data-track="linea-carrito.eliminar"
            class="min-h-11 rounded-control px-3 text-sm font-semibold"
            [class]="agotada() ? 'bg-danger text-primary-foreground hover:opacity-90' : 'text-danger hover:bg-surface-muted'"
            [attr.aria-label]="'cart.removeNamed' | transloco: { nombre: producto().nombre }"
            (click)="eliminar.emit()"
          >{{ 'cart.remove' | transloco }}</button>
        </div>
      </div>
    </div>
  `,
})
export class CartLine {
  readonly detalle = input.required<LineaDetalle>();
  /** `USD` si no hay tipo de cambio: el pago siempre es en soles, pero entonces solo se puede mostrar la referencia. */
  readonly moneda = input.required<Moneda>();
  readonly cambiar = output<number>();
  readonly eliminar = output<void>();

  private readonly lang = inject(LanguageService).lang;
  protected readonly producto = computed(() => this.detalle().producto);
  protected readonly agotada = computed(() => this.detalle().estado === 'agotado');

  private readonly mostrar = (pen: number | null, usd: number) => (this.moneda() === 'PEN' && pen !== null ? formatear(pen, 'PEN', this.lang()) : formatear(usd, 'USD', this.lang()));
  protected readonly unitario = computed(() => this.mostrar(this.detalle().precioPenCentimos, this.detalle().precioUsdCentimos));
  protected readonly subtotal = computed(() => this.mostrar(this.detalle().subtotalPenCentimos, this.detalle().subtotalUsdCentimos));
}
