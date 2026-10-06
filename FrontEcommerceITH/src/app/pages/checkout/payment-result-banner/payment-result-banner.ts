import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Faltante, MetodoPago } from '../../../core/orders/orders.models';
import { Icon } from '../../../shared/ui/icon/icon';

export type ResultadoBanner =
  | { tipo: 'rechazado'; metodo: MetodoPago }
  | { tipo: 'sin_respuesta' }
  | { tipo: 'SIN_STOCK'; faltantes: Faltante[] }
  | { tipo: 'TOTAL_CAMBIO'; antes: string; despues: string };

/**
 * Qué pasó con el pago (spec 006, CA-3.4, 5.2–5.4): SIEMPRE dice "No se realizó ningún cargo" y ofrece la salida que corresponde (H9, H3).
 * `role="alert"`: se anuncia solo; la página le lleva el foco al aparecer.
 */
@Component({
  selector: 'app-payment-result-banner',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resultado(); as r) {
      <div #caja role="alert" tabindex="-1" class="grid gap-2 rounded-card border border-danger bg-surface p-4 text-sm outline-none">
        <p class="flex items-start gap-2 font-semibold text-danger"><app-icon name="advertencia" [size]="20" /> <span>{{ titulo() | transloco: params() }}</span></p>

        @if (r.tipo === 'SIN_STOCK') {
          <ul class="list-disc pl-6">
            @for (f of r.faltantes; track f.sku) { <li>{{ 'payment.soldOutLine' | transloco: { nombre: f.nombre, pedido: f.pedido, disponible: f.disponible } }}</li> }
          </ul>
        }
        <p class="font-medium">{{ 'payment.noCharge' | transloco }}</p>

        <div class="flex flex-wrap gap-2">
          @switch (r.tipo) {
            @case ('sin_respuesta') {
              <button type="button" data-track="checkout.reintentar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="reintentar.emit()">{{ 'payment.retry' | transloco }}</button>
            }
            @case ('SIN_STOCK') {
              <button type="button" data-track="checkout.ajustar-pedido" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="ajustar.emit()">{{ 'payment.adjustOrder' | transloco }}</button>
              <button type="button" class="min-h-11 rounded-control border border-border px-4 font-semibold hover:bg-surface-muted" (click)="ajustar.emit()">{{ 'checkout.backToCart' | transloco }}</button>
            }
          }
        </div>
      </div>
    }
  `,
})
export class PaymentResultBanner {
  readonly resultado = input<ResultadoBanner | null>(null);
  readonly reintentar = output<void>();
  readonly ajustar = output<void>();
  private readonly caja = viewChild<ElementRef<HTMLElement>>('caja');

  protected readonly titulo = computed(() => {
    const r = this.resultado();
    if (!r) return '';
    return r.tipo === 'rechazado' ? `payment.rejected.${r.metodo}` : r.tipo === 'sin_respuesta' ? 'payment.noResponse' : r.tipo === 'SIN_STOCK' ? 'payment.soldOutTitle' : 'payment.totalChanged';
  });
  protected readonly params = computed(() => {
    const r = this.resultado();
    return r?.tipo === 'TOTAL_CAMBIO' ? { antes: r.antes, despues: r.despues } : {};
  });

  /** El foco va al mensaje al fallar el pago (accesibilidad). */
  enfocar(): void {
    this.caja()?.nativeElement.focus();
  }
}
