import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { AddToCart } from '../../core/cart/add-to-cart';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { MiEquipoService } from '../../core/compat/mi-equipo.service';
import { especificacionesOrdenadas } from '../../core/catalog/catalog.logic';
import { Atributo, DetalleCategoria, EquipoConMarca, Marca, Producto } from '../../core/catalog/catalog.models';
import { Viewport } from '../../core/ui/viewport';
import { Breadcrumbs, Miga } from '../../shared/ui/breadcrumbs/breadcrumbs';
import { CollapsibleSection } from '../../shared/ui/collapsible-section/collapsible-section';
import { CompatBadge } from '../../shared/ui/compat-badge/compat-badge';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { Price } from '../../shared/ui/price/price';
import { ProductCard } from '../../shared/ui/product-card/product-card';
import { QuantityInput } from '../../shared/ui/quantity-input/quantity-input';
import { StockBadge } from '../../shared/ui/stock-badge/stock-badge';
import { enfocarBuscador } from '../../shared/util/focus-search';
import { CompatibleList } from './compatible-list/compatible-list';
import { Gallery } from './gallery/gallery';
import { SpecTable } from './spec-table/spec-table';

interface VistaProducto {
  producto: Producto;
  categoria: DetalleCategoria | null;
  marca: Marca | null;
  atributos: Atributo[];
  equipos: EquipoConMarca[];
  relacionados: Producto[];
}

/**
 * Ficha de producto (HU-5 a HU-7). Revelación progresiva: arriba lo esencial en lenguaje simple (nombre, precio, stock,
 * condición explicada, garantía, comprar) y los identificadores técnicos discretos; la tabla completa, más abajo y sin pestañas.
 */
@Component({
  selector: 'app-producto',
  imports: [
    RouterLink, TranslocoPipe, Breadcrumbs, Gallery, Price, StockBadge, QuantityInput, SpecTable, CompatibleList, CollapsibleSection, ProductCard,
    EmptyState, Icon, CompatBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6">
      @if (vista(); as v) {
        <app-breadcrumbs [items]="migas()" />

        <div class="mt-4 grid gap-8 md:grid-cols-5">
          <div class="md:col-span-2"><app-gallery [imagenes]="v.producto.imagenes" /></div>

          <div class="md:col-span-3">
            <h1 class="text-2xl font-bold md:text-3xl">{{ v.producto.nombre }}</h1>

            <!-- Identificadores técnicos: arriba pero discretos, seleccionables y con "Copiar" (CA-6.1). -->
            <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              @if (v.marca) { <span>{{ v.marca.nombre }}</span> }
              <span>{{ v.producto.modelo }}</span>
              @if (v.producto.numero_parte; as pn) {
                <span class="inline-flex items-center gap-1">
                  {{ 'catalog.partNumber' | transloco }}: <span class="font-mono text-foreground select-all">{{ pn }}</span>
                  <button
                    type="button"
                    data-track="ficha-tecnica.copiar-pn"
                    class="inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-medium text-primary hover:bg-surface-muted"
                    [attr.aria-label]="'catalog.copyPn' | transloco"
                    (click)="copiar(pn)"
                  >
                    <app-icon [name]="copiado() ? 'copiado' : 'copiar'" [size]="16" />
                    <span aria-live="polite">{{ (copiado() ? 'catalog.copied' : 'catalog.copy') | transloco }}</span>
                  </button>
                </span>
              }
              <span>{{ 'catalog.sku' | transloco }}: <span class="font-mono text-foreground select-all">{{ v.producto.sku }}</span></span>
            </p>

            <!-- Bloque de compra: precio, stock y botón juntos (proximidad de Gestalt, Fitts). -->
            <section class="mt-5 grid gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
              <div data-zone="precio" class="text-3xl"><app-price [usd]="v.producto.precio_usd" /></div>
              <app-stock-badge [stock]="v.producto.stock" />

              @if (miEquipo.evaluar(v.producto); as c) {
                <app-compat-badge [resultado]="c" variante="detallado" [equipoNombre]="miEquipo.nombre()" [subcategoria]="miEquipo.slugSubcategoria(v.producto)" />
              } @else if (miEquipo.aplica(v.producto)) {
                <p data-zone="compatibilidad" class="flex flex-wrap items-center gap-x-2 text-sm">
                  {{ 'compat.productInvite' | transloco }}
                  <button type="button" data-track="compatibilidad.indicar-equipo" class="min-h-11 rounded-control px-2 font-semibold text-primary underline hover:bg-surface-muted" (click)="miEquipo.abrirSelector()">{{ 'compat.tag.indicate' | transloco }}</button>
                </p>
              }

              <div>
                <p class="text-sm"><span class="font-semibold">{{ 'condition.' + v.producto.condicion + '.label' | transloco }}</span></p>
                <p class="text-sm text-muted">{{ 'condition.' + v.producto.condicion + '.help' | transloco }}</p>
              </div>

              <p class="text-sm">{{ (v.producto.garantia_meses > 0 ? 'catalog.warranty' : 'catalog.noWarranty') | transloco: { n: v.producto.garantia_meses } }}</p>
              <p class="flex items-center gap-2 text-sm text-muted"><app-icon name="envio" [size]="16" /> {{ 'shipping.included' | transloco }}</p>

              <div data-zone="cta-principal" class="flex flex-wrap items-start gap-3">
                @if (v.producto.stock > 0) {
                  <app-quantity-input [max]="v.producto.stock" [(valor)]="cantidad" />
                }
                <button
                  type="button"
                  data-track="cta-principal.agregar-carrito"
                  class="min-h-12 min-w-48 flex-1 rounded-control bg-accent px-6 font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
                  [disabled]="v.producto.stock <= 0"
                  (click)="agregar(v.producto)"
                >{{ (v.producto.stock > 0 ? 'catalog.addToCart' : 'catalog.soldOut') | transloco }}</button>
              </div>
            </section>
          </div>
        </div>

        <div class="mt-10 grid gap-6">
          @if (filas().length) {
            <app-collapsible-section [titulo]="'catalog.specs' | transloco" [plegable]="movil()" [abierta]="true">
              <app-spec-table [especificaciones]="filas()" />
            </app-collapsible-section>
          }
          <app-collapsible-section [titulo]="'catalog.description' | transloco" [plegable]="movil()">
            <p class="max-w-3xl text-sm leading-relaxed">{{ v.producto.descripcion }}</p>
          </app-collapsible-section>
          @if (v.equipos.length) {
            <app-collapsible-section [titulo]="'catalog.compatibleWith' | transloco" [plegable]="movil()">
              <app-compatible-list [modelos]="modelos()" />
            </app-collapsible-section>
          }
        </div>

        @if (v.relacionados.length) {
          <section class="mt-12" aria-labelledby="relacionados">
            <h2 id="relacionados" class="mb-4 text-xl font-semibold">{{ 'catalog.related' | transloco }}</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (p of v.relacionados; track p.sku) {
                <app-product-card [producto]="p" [compat]="miEquipo.evaluar(p)" (agregar)="agregarRelacionado($event)" />
              }
            </div>
          </section>
        }
      } @else {
        <app-empty-state [titulo]="'catalog.notFound.title' | transloco" [mensaje]="'catalog.notFound.body' | transloco">
          <a routerLink="/" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'catalog.toHome' | transloco }}</a>
          <button type="button" class="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-medium hover:bg-surface-muted" (click)="irAlBuscador()">{{ 'catalog.useSearch' | transloco }}</button>
        </app-empty-state>
      }
    </div>
  `,
})
export default class ProductoPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogApi);
  private readonly addToCart = inject(AddToCart);
  protected readonly miEquipo = inject(MiEquipoService);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);

  protected readonly movil = inject(Viewport).movil;
  protected readonly cantidad = signal(1);
  protected readonly copiado = signal(false);
  private temporizador?: ReturnType<typeof setTimeout>;

  /** `null` si el producto no existe o está inactivo (CA-7.3). */
  protected readonly vista = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('sku') ?? ''),
      switchMap((sku) =>
        this.catalog.producto(sku).pipe(
          switchMap((producto) =>
            producto
              ? forkJoin({
                  categoria: this.catalog.categoriaDe(producto.categoria_id),
                  marca: this.catalog.marca(producto.marca_id),
                  atributos: this.catalog.atributosDe(producto.categoria_id),
                  equipos: this.catalog.equiposCompatibles(producto.id),
                  relacionados: this.catalog.relacionados(producto, 4),
                }).pipe(map((datos): VistaProducto | null => ({ producto, ...datos })))
              : of(null),
          ),
        ),
      ),
    ),
    { initialValue: null },
  );

  protected readonly filas = computed(() => {
    const v = this.vista();
    return v ? especificacionesOrdenadas(v.producto, v.atributos) : [];
  });
  protected readonly modelos = computed(() => (this.vista()?.equipos ?? []).map((e) => `${e.marca} ${e.modelo}`));

  /** Inicio › categoría › subcategoría › producto (CA-7.1). */
  protected readonly migas = computed<Miga[]>(() => {
    const v = this.vista();
    if (!v) return [];
    const d = v.categoria;
    return [
      { clave: 'catalog.home', ruta: ['/'] },
      ...(d?.padre ? [{ clave: d.padre.clave_i18n, ruta: ['/catalogo', d.padre.slug] }] : []),
      ...(d ? [{ clave: d.categoria.clave_i18n, ruta: ['/catalogo', d.categoria.slug] }] : []),
      { texto: v.producto.nombre },
    ];
  });

  constructor() {
    // Título de la pestaña: nombre del producto + "· TechSuply" (CA-7.4).
    effect(() => {
      const v = this.vista();
      this.title.setTitle(v ? `${v.producto.nombre} · TechSuply` : 'TechSuply');
    });
    // Al pasar a otro producto (p. ej. desde "Relacionados") la cantidad vuelve a 1.
    effect(() => {
      this.vista();
      untracked(() => this.cantidad.set(1));
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }

  protected agregar(producto: Producto): void {
    this.addToCart.agregar(producto, this.cantidad(), 'ficha');
  }

  protected agregarRelacionado(producto: Producto): void {
    this.addToCart.agregar(producto, 1, 'tarjeta');
  }

  /** Copia el P/N y muestra "Copiado" 2 s (estado de la vista; el `setTimeout` no se usa para forzar el render). */
  protected async copiar(pn: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(pn);
    } catch {
      return; // sin permiso del navegador: el P/N sigue siendo seleccionable como texto
    }
    this.copiado.set(true);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.copiado.set(false), 2000);
  }

  protected irAlBuscador(): void {
    enfocarBuscador(this.document);
  }
}
