import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { SessionApi } from '../../core/auth/session.api';
import { CurrencyService } from '../../core/currency/currency.service';
import { LanguageService } from '../../core/i18n/language.service';
import { tituloDePagina } from '../../core/i18n/page-title';
import { OrdersApi } from '../../core/orders/orders.api';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { OrderSummary } from '../../shared/ui/order-summary/order-summary';

/**
 * Confirmación del pedido (spec 006, HU-6). Solo LEE un pedido ya pagado: recargar o volver con "Atrás" no repite nada (CA-6.3).
 * "Tarjeta terminada en 1111": los 4 dígitos llegan por el estado de la navegación y no se guardan; al recargar se muestra solo "Tarjeta".
 */
@Component({
  selector: 'app-pedido-confirmado',
  imports: [RouterLink, TranslocoPipe, EmptyState, Icon, OrderSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pedido(); as p) {
      <div class="grid gap-6">
        <div id="pedido-exito" role="status" tabindex="-1" class="grid gap-1 rounded-card border border-success bg-surface p-5 outline-none">
          <h1 class="flex items-center gap-2 text-2xl font-bold text-success"><app-icon name="compatible" [size]="28" /> {{ 'order.thanks' | transloco }}</h1>
          <p class="text-sm">
            {{ 'order.code' | transloco }}: <span class="font-mono text-base font-semibold select-all">{{ p.codigo }}</span>
            <button type="button" data-track="pedido.copiar-codigo" class="ml-2 min-h-11 rounded-control px-2 font-medium text-primary hover:bg-surface-muted" [attr.aria-label]="'order.copyCode' | transloco" (click)="copiar(p.codigo)">
              <app-icon [name]="copiado() ? 'copiado' : 'copiar'" [size]="16" /> <span aria-live="polite">{{ (copiado() ? 'catalog.copied' : 'catalog.copy') | transloco }}</span>
            </button>
          </p>
          <p class="text-sm text-muted">{{ fecha() }} · {{ medio().clave | transloco: medio().params }}</p>
          <p class="mt-2 text-sm font-medium">{{ 'order.delivery' | transloco }}</p>
        </div>

        <app-order-summary [pedido]="p" [moneda]="moneda()" />

        <div class="flex flex-wrap gap-3">
          <a routerLink="/cuenta/pedidos" data-track="pedido.ver-pedidos" class="inline-flex min-h-12 items-center rounded-control bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'order.viewOrders' | transloco }}</a>
          <a routerLink="/" data-track="carrito.seguir-comprando" class="inline-flex min-h-12 items-center rounded-control border border-border bg-surface px-6 font-semibold hover:bg-surface-muted">{{ 'cart.keepShopping' | transloco }}</a>
        </div>
      </div>
    } @else {
      <app-empty-state [titulo]="'order.notFound.title' | transloco" [mensaje]="'order.notFound.body' | transloco">
        <a routerLink="/" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'catalog.toHome' | transloco }}</a>
      </app-empty-state>
    }
  `,
})
export default class PedidoConfirmado {
  private readonly orders = inject(OrdersApi);
  private readonly session = inject(SessionApi);
  private readonly lang = inject(LanguageService).lang;
  private readonly document = inject(DOCUMENT);
  protected readonly moneda = inject(CurrencyService).currency;
  protected readonly copiado = signal(false);

  /** Un pedido ajeno, inexistente o que no está pagado se ve igual: "No encontramos este pedido" (CA-6.4). */
  protected readonly pedido = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((p) => {
        const pedido = this.orders.obtener(p.get('codigo') ?? '', this.session.usuario()?.id ?? '');
        return pedido?.estado === 'pagado' ? pedido : null;
      }),
    ),
    { initialValue: null },
  );

  /** Estado de la navegación: solo existe justo después de pagar (no se guarda). */
  private readonly estado = history.state as { ultimos4?: string } | null;

  protected readonly fecha = computed(() => {
    const p = this.pedido();
    return p ? new Intl.DateTimeFormat(this.lang() === 'qu-PE' ? 'es-PE' : this.lang(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(p.created_at)) : '';
  });

  protected readonly medio = computed(() => {
    const metodo = this.pedido()?.pagos.find((x) => x.resultado === 'aprobado')?.metodo;
    if (metodo === 'yape') return { clave: 'payment.yape.name', params: {} };
    return this.estado?.ultimos4 ? { clave: 'order.cardEnding', params: { n: this.estado.ultimos4 } } : { clave: 'order.card', params: {} };
  });

  constructor() {
    tituloDePagina('order.pageTitle');
    // El foco va al mensaje de éxito al cargar (accesibilidad).
    setTimeout(() => this.document.getElementById('pedido-exito')?.focus());
  }

  protected async copiar(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      return; // sin permiso del navegador: el código sigue siendo seleccionable
    }
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2000);
  }
}
