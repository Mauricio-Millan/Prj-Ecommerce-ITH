import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { SessionApi } from '../../../core/auth/session.api';
import { LanguageService } from '../../../core/i18n/language.service';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { estadoActual } from '../../../core/orders/orders.logic';
import { OrdersApi } from '../../../core/orders/orders.api';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { OrderStatus } from '../../../shared/ui/order-status/order-status';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { formatear } from '../../../shared/ui/price/price';

const MINIATURAS = 3;

/**
 * Mis pedidos (spec 007, HU-1): lo cobrado, del más reciente al más antiguo, de 10 en 10 con la página en la URL (H4).
 * Cada pedido es UN enlace de fila completa (Fitts) con código, fecha, estado, total, cantidad de productos y miniaturas (H6).
 */
@Component({
  selector: 'app-pedidos',
  imports: [RouterLink, TranslocoPipe, EmptyState, OrderStatus, Pagination],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-6">
      <h1 class="text-2xl font-bold">{{ 'orders.title' | transloco }}</h1>

      @if (pagina().items.length) {
        <ul data-zone="lista-pedidos" class="mt-4 grid gap-3">
          @for (p of pagina().items; track p.codigo) {
            <li>
              <a
                [routerLink]="['/cuenta/pedidos', p.codigo]"
                [queryParams]="{ desde: pagina().pagina > 1 ? pagina().pagina : null }"
                data-track="pedidos.abrir"
                class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-border bg-surface p-4 shadow-card hover:border-primary"
              >
                <span class="grid min-w-0 flex-1 gap-1">
                  <span class="font-mono text-base font-semibold">{{ p.codigo }}</span>
                  <span class="text-sm text-muted">{{ fecha(p.created_at) }}</span>
                  <app-order-status [estado]="estado(p)" />
                </span>
                <span class="flex items-center gap-1" aria-hidden="true">
                  @for (i of miniaturas(p); track i.sku) {
                    <img [src]="i.imagen" alt="" width="48" height="48" class="size-12 rounded-control bg-surface-muted object-cover" />
                  }
                  @if (p.items.length > miniaturasMax) { <span class="text-sm font-semibold text-muted">+{{ p.items.length - miniaturasMax }}</span> }
                </span>
                <span class="grid text-right text-sm">
                  <span class="text-lg font-bold tabular-nums">{{ soles(p.total_pen_centimos) }}</span>
                  <span class="text-muted">{{ (p.items.length === 1 ? 'orders.itemsOne' : 'orders.items') | transloco: { n: p.items.length } }}</span>
                  <span class="font-semibold text-primary">{{ 'orders.viewDetail' | transloco }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
        <div class="mt-6">
          <app-pagination seguimiento="pedidos.pagina" [pagina]="pagina().pagina" [total]="pagina().total" [tamano]="pagina().tamano" (cambiar)="cambiarPagina($event)" />
        </div>
      } @else {
        <!-- Sin pedidos: nunca una página en blanco (CA-1.4, H9). -->
        <app-empty-state [titulo]="'orders.empty.title' | transloco" [mensaje]="'orders.empty.body' | transloco">
          <a routerLink="/" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'cart.keepShopping' | transloco }}</a>
          <a routerLink="/armador" class="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold hover:bg-surface-muted">{{ 'orders.buildPc' | transloco }}</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class Pedidos {
  private readonly orders = inject(OrdersApi);
  private readonly session = inject(SessionApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LanguageService).lang;

  protected readonly miniaturasMax = MINIATURAS;
  private readonly numeroDePagina = toSignal(this.route.queryParamMap.pipe(map((q) => Number(q.get('pagina')) || 1)), { initialValue: 1 });
  protected readonly pagina = computed(() => this.orders.listar(this.session.usuario()?.id ?? '', { pagina: this.numeroDePagina() }));

  protected readonly estado = estadoActual;
  protected readonly soles = (c: number) => formatear(c, 'PEN', this.lang());
  protected readonly miniaturas = (p: { items: { sku: string; imagen: string }[] }) => p.items.slice(0, MINIATURAS);

  constructor() {
    tituloDePagina('orders.title');
  }

  protected fecha(iso: string): string {
    return new Intl.DateTimeFormat(this.lang() === 'qu-PE' ? 'es-PE' : this.lang(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  protected cambiarPagina(n: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pagina: n === 1 ? null : n }, queryParamsHandling: 'merge' });
  }
}
