import { DOCUMENT } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Injector, OnDestroy, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SessionApi } from '../../core/auth/session.api';
import { AddToCart } from '../../core/cart/add-to-cart';
import { CartApi } from '../../core/cart/cart.api';
import { detallar, resumen as calcularResumen } from '../../core/cart/cart.logic';
import { AvisoCarrito, LineaDetalle } from '../../core/cart/cart.models';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { Producto } from '../../core/catalog/catalog.models';
import { MiEquipoService } from '../../core/compat/mi-equipo.service';
import { CurrencyService } from '../../core/currency/currency.service';
import { LanguageService } from '../../core/i18n/language.service';
import { tituloDePagina } from '../../core/i18n/page-title';
import { InteractionLogger } from '../../core/telemetry/interaction-logger';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { ProductCard } from '../../shared/ui/product-card/product-card';
import { formatear } from '../../shared/ui/price/price';
import { ToastService } from '../../shared/ui/toast/toast';
import { enfocarBuscador } from '../../shared/util/focus-search';
import { CartLine } from './cart-line/cart-line';
import { CartSummary } from './cart-summary/cart-summary';

/** Los cambios de la misma línea en este lapso se agrupan en un solo `cart_quantity` (spec 005 § 5). */
const AGRUPAR_MS = 500;

/**
 * Página del carrito (spec 005). Al entrar pone el carrito al día con el catálogo (stock, productos que ya no están) y calcula líneas y
 * resumen en céntimos con `computed`: el total siempre coincide con la suma de lo que se ve.
 */
@Component({
  selector: 'app-carrito',
  imports: [RouterLink, TranslocoPipe, CartLine, CartSummary, EmptyState, Icon, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6 pb-44 lg:pb-8">
      @if (lineas().length) {
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h1 class="text-2xl font-bold">{{ (lineas().length === 1 ? 'cart.titleOne' : 'cart.title') | transloco: { n: lineas().length } }}</h1>
          <button type="button" data-track="resumen-pedido.vaciar" class="min-h-11 rounded-control px-3 text-sm font-semibold text-danger hover:bg-surface-muted" (click)="vaciar()">{{ 'cart.clear' | transloco }}</button>
        </div>

        <div class="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <ul class="grid gap-3">
              @for (l of lineas(); track l.linea.sku) {
                <li>
                  <app-cart-line [detalle]="l" [moneda]="moneda()" (cambiar)="cambiar(l, $event)" (eliminar)="eliminar(l)" />
                </li>
              }
            </ul>
            <a routerLink="/" data-track="carrito.seguir-comprando" class="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <app-icon name="volver" [size]="18" /> {{ 'cart.keepShopping' | transloco }}
            </a>
          </div>

          <app-cart-summary [resumen]="resumen()" [moneda]="moneda()" [tc]="tc()" (continuar)="continuar()" (irAAgotado)="irAlPrimerAgotado()" />
        </div>
      } @else {
        <!-- Nunca una página en blanco (CA-1.4, H9). El foco llega aquí al vaciar el carrito. -->
        <div id="carrito-vacio" tabindex="-1" class="outline-none">
          <app-empty-state [titulo]="'cart.empty.title' | transloco" [mensaje]="'cart.empty.body' | transloco">
            @for (cat of categorias(); track cat.slug) {
              <a [routerLink]="['/catalogo', cat.slug]" class="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:bg-surface-muted">{{ cat.clave_i18n | transloco }}</a>
            }
            <button type="button" class="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" (click)="irAlBuscador()">{{ 'cart.empty.search' | transloco }}</button>
          </app-empty-state>
        </div>

        @if (destacados().length) {
          <section class="mt-6" aria-labelledby="carrito-destacados">
            <h2 id="carrito-destacados" class="mb-4 text-xl font-semibold">{{ 'home.featured' | transloco }}</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (p of destacados(); track p.sku) {
                <app-product-card [producto]="p" [compat]="miEquipo.evaluar(p)" (agregar)="agregar($event)" />
              }
            </div>
          </section>
        }
      }

      <!-- Anuncia el total nuevo a los lectores de pantalla al cambiar cantidades o eliminar (accesibilidad). -->
      <p class="sr-only" aria-live="polite">{{ lineas().length ? ('cart.totalAnnounce' | transloco: { monto: totalTexto() }) : '' }}</p>
    </div>
  `,
})
export default class Carrito implements OnDestroy {
  private readonly cart = inject(CartApi);
  private readonly catalog = inject(CatalogApi);
  private readonly currency = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;
  private readonly logger = inject(InteractionLogger);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly session = inject(SessionApi);
  private readonly addToCart = inject(AddToCart);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  protected readonly miEquipo = inject(MiEquipoService);

  private readonly productos = toSignal(this.catalog.todos(), { initialValue: [] as readonly Producto[] });
  protected readonly categorias = toSignal(this.catalog.categoriasRaiz(), { initialValue: [] });
  protected readonly destacados = toSignal(this.catalog.destacados(4), { initialValue: [] as Producto[] });

  /** Líneas ajustadas al abrir el carrito: se marcan con "Ajustamos la cantidad: solo quedan N" (CA-4.1). */
  private readonly ajustadas = signal<ReadonlySet<string>>(new Set());

  protected readonly tcActual = computed(() => this.currency.exchangeRate());
  protected readonly tc = this.tcActual;
  private readonly tcNumero = computed(() => (this.tcActual() ? Number(this.tcActual()!.valor) : null));
  /** USD si no hay tipo de cambio: se ve la referencia y el pago queda bloqueado (CA-1.3c). */
  protected readonly moneda = computed(() => (this.tcNumero() ? this.currency.currency() : 'USD'));

  protected readonly lineas = computed(() => detallar(this.cart.items(), this.productos(), this.tcNumero(), this.ajustadas()));
  protected readonly resumen = computed(() => calcularResumen(this.lineas()));
  protected readonly totalTexto = computed(() =>
    this.moneda() === 'PEN' ? formatear(this.resumen().totalPenCentimos, 'PEN', this.lang()) : formatear(this.resumen().totalUsdCentimos, 'USD', this.lang()),
  );

  /** Cambios de cantidad pendientes de registrar: `de` es la cantidad antes del primer clic del grupo. */
  private readonly pendientes = new Map<string, { de: number; timer: ReturnType<typeof setTimeout> }>();

  constructor() {
    tituloDePagina('cart.pageTitle');
    this.aplicarAvisos(this.cart.reconciliar());
  }

  ngOnDestroy(): void {
    for (const [sku, p] of this.pendientes) {
      clearTimeout(p.timer);
      this.emitirCantidad(sku, p.de);
    }
  }

  /** Líneas quitadas → aviso; líneas ajustadas → marca en su línea (CA-4.1, 4.4). */
  private aplicarAvisos(avisos: AvisoCarrito[]): void {
    const ajustadas = new Set(this.ajustadas());
    for (const a of avisos) {
      if (a.tipo === 'quitado') this.toast.show('cart.gone', 'advertencia', [], { nombre: a.nombre });
      else ajustadas.add(a.sku);
    }
    this.ajustadas.set(ajustadas);
  }

  protected cambiar(l: LineaDetalle, cantidad: number): void {
    const sku = l.linea.sku;
    if (cantidad === l.linea.cantidad) return;
    const pendiente = this.pendientes.get(sku);
    clearTimeout(pendiente?.timer);
    this.pendientes.set(sku, { de: pendiente?.de ?? l.linea.cantidad, timer: setTimeout(() => this.cerrarGrupo(sku), AGRUPAR_MS) });
    this.cart.cambiarCantidad(sku, cantidad, l.producto.stock);
    // Si el usuario cambió la cantidad, el aviso de ajuste ya no corresponde.
    if (this.ajustadas().has(sku)) this.ajustadas.update((s) => new Set([...s].filter((x) => x !== sku)));
  }

  private cerrarGrupo(sku: string): void {
    const p = this.pendientes.get(sku);
    this.pendientes.delete(sku);
    if (p) this.emitirCantidad(sku, p.de);
  }

  private emitirCantidad(sku: string, de: number): void {
    const a = this.cart.items().find((l) => l.sku === sku)?.cantidad;
    if (a !== undefined && a !== de) this.logger.track('cart_quantity', { sku, de, a });
  }

  /** Sin confirmación: el aviso trae "Deshacer" y cada aviso recupera SU producto (CA-3.1–3.3). El foco no se pierde. */
  protected eliminar(l: LineaDetalle): void {
    const todas = this.lineas();
    const i = todas.findIndex((x) => x.linea.sku === l.linea.sku);
    const vecino = todas[i + 1] ?? todas[i - 1];
    const quitada = this.cart.eliminar(l.linea.sku);
    if (!quitada) return;

    this.logger.track('remove_from_cart', { sku: l.linea.sku, cantidad: l.linea.cantidad });
    this.toast.show(
      'cart.removed',
      'info',
      [
        {
          clave: 'cart.undo',
          ejecutar: () => {
            this.cart.restaurar(quitada);
            this.logger.track('undo', { accion: 'eliminar', sku: l.linea.sku });
          },
        },
      ],
      { nombre: l.producto.nombre },
    );
    this.enfocar(vecino ? `linea-${vecino.linea.sku}` : 'carrito-vacio');
  }

  /** Vaciar sí pide confirmación: afecta a todo el carrito (CA-3.4). */
  protected vaciar(): void {
    const n = this.lineas().length;
    this.dialog
      .open<boolean>(ConfirmDialog, {
        data: { tituloClave: 'cart.clearTitle', mensajeClave: n === 1 ? 'cart.clearBodyOne' : 'cart.clearBody', params: { n }, confirmarClave: 'cart.clearConfirm' },
        ariaLabelledBy: 'confirmar-titulo',
        autoFocus: '[data-cancelar]',
      })
      .closed.subscribe((confirmado) => {
        if (!confirmado) return;
        for (const l of this.lineas()) this.logger.track('remove_from_cart', { sku: l.linea.sku, cantidad: l.linea.cantidad });
        this.cart.vaciar();
        this.enfocar('carrito-vacio');
      });
  }

  /** Baja hasta el primer agotado y lleva el foco a su "Eliminar" (CA-4.3, H6). */
  protected irAlPrimerAgotado(): void {
    const primero = this.lineas().find((l) => l.estado === 'agotado');
    const boton = primero ? this.document.getElementById(`eliminar-${primero.producto.sku}`) : null;
    boton?.scrollIntoView({ block: 'center' });
    boton?.focus();
  }

  /** Vuelve a revisar el stock justo antes de salir: pudo cambiar mientras el usuario miraba (CA-5.4). */
  protected continuar(): void {
    this.aplicarAvisos(this.cart.reconciliar());
    if (!this.resumen().puedePagar) return;
    if (this.session.usuario()) this.router.navigateByUrl('/checkout');
    else this.router.navigate(['/auth/login'], { queryParams: { volver: '/checkout' } });
  }

  protected agregar(producto: Producto): void {
    this.addToCart.agregar(producto, 1, 'tarjeta');
  }

  protected irAlBuscador(): void {
    enfocarBuscador(this.document);
  }

  private enfocar(id: string): void {
    afterNextRender(() => this.document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
