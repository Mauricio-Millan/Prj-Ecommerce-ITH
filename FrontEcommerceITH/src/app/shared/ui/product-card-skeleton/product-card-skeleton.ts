import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Misma caja que la tarjeta real, para que no salte el diseño al cargar (CA-3.8, H1). */
@Component({
  selector: 'app-product-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'block' },
  template: `
    <div class="flex h-full animate-pulse flex-col rounded-card border border-border bg-surface shadow-card motion-reduce:animate-none">
      <div class="aspect-square w-full rounded-t-card bg-surface-muted"></div>
      <div class="grid gap-3 p-3">
        <div class="h-4 w-4/5 rounded-control bg-surface-muted"></div>
        <div class="h-4 w-2/5 rounded-control bg-surface-muted"></div>
        <div class="h-11 rounded-control bg-surface-muted"></div>
      </div>
    </div>
  `,
})
export class ProductCardSkeleton {}
