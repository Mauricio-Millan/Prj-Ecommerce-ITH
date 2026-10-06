import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { SessionApi } from '../../../core/auth/session.api';
import { CartApi } from '../../../core/cart/cart.api';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { CurrencyService } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { OrdersApi } from '../../../core/orders/orders.api';
import { estadoActual, seguimiento } from '../../../core/orders/orders.logic';
import { Reorder } from '../../../core/orders/reorder';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { OrderStatus } from '../../../shared/ui/order-status/order-status';
import { OrderSummary } from '../../../shared/ui/order-summary/order-summary';
import { OrderTracking } from '../../../shared/ui/order-tracking/order-tracking';
import { ToastService } from '../../../shared/ui/toast/toast';
import { BoletaPrint } from './boleta-print/boleta-print';

/**
 * Detalle de un pedido (spec 007, HU-2 a HU-5): estado y seguimiento, lo pagado ese día (precios y tipo de cambio del pedido, no los de hoy),
 * "Volver a comprar" e "Imprimir boleta". Un pedido ajeno o inexistente se ve igual: "No encontramos este pedido" (CA-2.4).
 */
@Component({
  selector: 'app-pedido-detalle',
  imports: [RouterLink, TranslocoPipe, EmptyState, Icon, OrderStatus, OrderSummary, OrderTracking, BoletaPrint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pedido(); as p) {
      <div class="mx-auto max-w-4xl px-4 py-6">
        <div class="grid gap-6 print:hidden">
          <a routerLink="/cuenta/pedidos" [queryParams]="{ pagina: desde() }" data-track="pedidos.volver-lista" class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <app-icon name="volver" [size]="18" /> {{ 'orders.backToList' | transloco }}
          </a>

          <header class="grid gap-2 rounded-card border border-border bg-surface p-4 shadow-card">
            <h1 class="flex flex-wrap items-center gap-2 text-2xl font-bold">
              {{ 'orders.orderTitle' | transloco }} <span class="font-mono select-all">{{ p.codigo }}</span>
              <button type="button" data-track="pedidos.copiar-codigo" class="min-h-11 rounded-control px-2 text-sm font-medium text-primary hover:bg-surface-muted" [attr.aria-label]="'order.copyCode' | transloco" (click)="copiar(p.codigo)">
                <app-icon [name]="copiado() ? 'copiado' : 'copiar'" [size]="16" /> <span aria-live="polite">{{ (copiado() ? 'catalog.copied' : 'catalog.copy') | transloco }}</span>
              </button>
            </h1>
            <p class="text-sm text-muted">{{ fecha() }}</p>
            <app-order-status [estado]="estado()" variante="larga" />
          </header>

          <section aria-labelledby="seguimiento-titulo" class="rounded-card border border-border bg-surface p-4 shadow-card">
            <h2 id="seguimiento-titulo" class="mb-3 text-lg font-semibold">{{ 'orders.tracking' | transloco }}</h2>
            <app-order-tracking [pasos]="pasos()" />
          </section>

          <app-order-summary [pedido]="p" [moneda]="moneda()" [conFicha]="conFicha()" />

          <section class="grid gap-1 rounded-card border border-border bg-surface p-4 text-sm shadow-card">
            <p><span class="font-semibold">{{ 'orders.payment' | transloco }}:</span> {{ medio() | transloco }}</p>
            @if (estado() !== 'entregado' && estado() !== 'cancelado') {
              <p class="font-medium">{{ 'order.delivery' | transloco }}</p>
            }
          </section>

          <div class="flex flex-wrap gap-3">
            <button type="button" data-zone="cta-principal" data-track="cta-principal.volver-a-comprar" class="min-h-12 rounded-control bg-accent px-6 font-semibold text-accent-foreground hover:opacity-90" (click)="volverAComprar()">{{ 'orders.reorder' | transloco }}</button>
            <button type="button" data-track="pedidos.imprimir-boleta" class="min-h-12 rounded-control border border-border bg-surface px-6 font-semibold hover:bg-surface-muted" (click)="imprimir()">{{ 'orders.print' | transloco }}</button>
          </div>
        </div>
        <app-boleta-print [pedido]="p" />
      </div>
    } @else {
      <app-empty-state [titulo]="'order.notFound.title' | transloco" [mensaje]="'order.notFound.body' | transloco">
        <a routerLink="/cuenta/pedidos" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'orders.backToList' | transloco }}</a>
      </app-empty-state>
    }
  `,
})
export class PedidoDetalle {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(OrdersApi);
  private readonly session = inject(SessionApi);
  private readonly catalog = inject(CatalogApi);
  private readonly reorder = inject(Reorder);
  private readonly cart = inject(CartApi);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(InteractionLogger);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService).lang;
  private readonly document = inject(DOCUMENT);
  protected readonly moneda = inject(CurrencyService).currency;
  protected readonly copiado = signal(false);

  /** Solo pedidos cobrados y del usuario con sesión (CA-1.6, 2.4). */
  protected readonly pedido = toSignal(
    this.route.paramMap.pipe(
      map((p) => {
        const pedido = this.orders.obtener(p.get('codigo') ?? '', this.session.usuario()?.id ?? '');
        return pedido && pedido.historial_estados.some((h) => h.estado === 'pagado') ? pedido : null;
      }),
    ),
    { initialValue: null },
  );
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  /** La página de la lista en la que estaba: "Volver a mis pedidos" la conserva (CA-2.5). */
  protected readonly desde = computed(() => (Number(this.query().get('desde')) > 1 ? Number(this.query().get('desde')) : null));

  protected readonly estado = computed(() => (this.pedido() ? estadoActual(this.pedido()!) : 'pagado'));
  protected readonly pasos = computed(() => (this.pedido() ? seguimiento(this.pedido()!) : []));
  protected readonly medio = computed(() => (this.pedido()?.pagos.find((x) => x.resultado === 'aprobado')?.metodo === 'yape' ? 'payment.yape.name' : 'order.card'));
  protected readonly fecha = computed(() => (this.pedido() ? new Intl.DateTimeFormat(this.lang() === 'qu-PE' ? 'es-PE' : this.lang(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(this.pedido()!.created_at)) : ''));

  /** Los nombres llevan a la ficha solo si el producto todavía existe (CA-2.2, H9). */
  protected readonly conFicha = toSignal(this.catalog.todos().pipe(map((ps) => new Set(ps.filter((p) => p.activo).map((p) => p.sku)) as ReadonlySet<string>)), { initialValue: null });

  constructor() {
    tituloDePagina('orders.title');
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

  protected imprimir(): void {
    this.document.defaultView?.print();
  }

  /** Un único aviso con lo agregado y lo que no se pudo, y su "Deshacer" (CA-4.1–4.3). */
  protected volverAComprar(): void {
    const p = this.pedido();
    if (!p) return;
    const r = this.reorder.volverAComprar(p);
    const t = (clave: string, params?: Record<string, unknown>) => this.transloco.translate(clave, params);

    if (r.agregados === 0) {
      this.toast.show('common.raw', 'advertencia', [{ clave: 'cart.view', ejecutar: () => this.router.navigateByUrl('/carrito') }], { texto: t('orders.reorderNothing') });
      return;
    }
    const partes = [t(r.agregados === 1 ? 'orders.reorderAddedOne' : 'orders.reorderAdded', { n: r.agregados })];
    r.agotados.forEach((nombre) => partes.push(t('orders.reorderSoldOut', { nombre })));
    r.noDisponibles.forEach((nombre) => partes.push(t('orders.reorderGone', { nombre })));
    if (r.preciosCambiaron) partes.push(t('orders.reorderPrices'));

    this.toast.show(
      'common.raw',
      r.agotados.length || r.noDisponibles.length ? 'advertencia' : 'exito',
      [
        { clave: 'cart.view', ejecutar: () => this.router.navigateByUrl('/carrito') },
        {
          clave: 'cart.undo',
          ejecutar: () => {
            this.cart.deshacerUltimo();
            this.logger.track('undo', { accion: 'volver_a_comprar', codigo: p.codigo });
          },
        },
      ],
      { texto: partes.join('. ') },
      { duracionMs: 10_000, pausarAlEnfocar: true },
    );
  }
}
