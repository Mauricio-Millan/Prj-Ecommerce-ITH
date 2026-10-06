import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Producto } from '../../../core/catalog/catalog.models';
import { ResultadoCompat } from '../../../core/compat/compat.logic';
import { CompatBadge } from '../compat-badge/compat-badge';
import { Price } from '../price/price';
import { StockBadge } from '../stock-badge/stock-badge';

/**
 * Una sola tarjeta para inicio, listado y relacionados (H4). Orden fijo (constitución P1):
 * imagen → nombre → precio → estado de stock → acción. Imagen + nombre son UN enlace: el área clicable es grande (Fitts).
 */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, TranslocoPipe, CompatBadge, Price, StockBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article data-zone="tarjeta-producto" class="flex h-full flex-col rounded-card border border-border bg-surface shadow-card">
      <a [routerLink]="['/producto', producto().sku]" data-track="tarjeta-producto.abrir" class="group block rounded-t-card">
        <!-- alt vacío: el nombre del producto está en el mismo enlace; repetirlo haría que el lector lo lea dos veces. -->
        <img
          [src]="imagen()"
          alt=""
          width="600"
          height="600"
          [attr.loading]="prioritaria() ? 'eager' : 'lazy'"
          [attr.fetchpriority]="prioritaria() ? 'high' : null"
          class="aspect-square w-full rounded-t-card bg-surface-muted object-cover"
        />
        <h3 class="line-clamp-2 px-3 pt-3 text-sm font-medium text-foreground group-hover:underline">{{ producto().nombre }}</h3>
      </a>
      <div class="mt-auto grid gap-2 p-3">
        <div data-zone="precio" class="text-lg"><app-price [usd]="producto().precio_usd" [mostrarNota]="false" /></div>
        <app-stock-badge [stock]="producto().stock" />
        <!-- Sello de compatibilidad con "Mi equipo" (spec 003, CA-2.1). Sin equipo o si no aplica, no se dibuja nada. -->
        @if (compat(); as c) { <app-compat-badge [resultado]="c" /> }
        <button
          type="button"
          class="min-h-11 rounded-control bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
          data-track="tarjeta-producto.agregar-carrito"
          [disabled]="agotado()"
          (click)="agregar.emit(producto())"
        >
          {{ (agotado() ? 'catalog.soldOut' : 'catalog.addToCart') | transloco }}
        </button>
      </div>
    </article>
  `,
})
export class ProductCard {
  readonly producto = input.required<Producto>();
  readonly agregar = output<Producto>();
  /** Resultado de la compatibilidad con "Mi equipo" (spec 003); `null` si no hay equipo. */
  readonly compat = input<ResultadoCompat | null>(null);
  /** Las tarjetas de la primera fila son el LCP: se cargan de inmediato. El resto, `lazy` (Lighthouse). */
  readonly prioritaria = input(false);

  protected readonly agotado = computed(() => this.producto().stock <= 0);
  protected readonly imagen = computed(() => this.producto().imagenes[0]?.url ?? '');
}
