import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { map, of, switchMap } from 'rxjs';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { DetalleCategoria, Producto } from '../../core/catalog/catalog.models';
import { Breadcrumbs, Miga } from '../../shared/ui/breadcrumbs/breadcrumbs';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ProductCardSkeleton } from '../../shared/ui/product-card-skeleton/product-card-skeleton';
import { enfocarBuscador } from '../../shared/util/focus-search';
import { ListadoVista } from '../listado/listado-vista';

interface Vista {
  detalle: DetalleCategoria | null;
  productos: Producto[];
}

/**
 * Categoría raíz o subcategoría (spec 001, HU-2). Obtiene los productos y deja el resto —filtros, orden, paginación y URL— al
 * `listado-vista` compartido con la búsqueda (spec 002).
 */
@Component({
  selector: 'app-categoria',
  imports: [RouterLink, TranslocoPipe, Breadcrumbs, EmptyState, ListadoVista, ProductCardSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6">
      @if (vista(); as v) {
        @if (v.detalle; as d) {
          <app-breadcrumbs [items]="migas()" />
          <h1 class="mt-3 text-2xl font-bold md:text-3xl">{{ d.categoria.clave_i18n | transloco }}</h1>

          @if (d.hijas.length) {
            <nav class="mt-4" [attr.aria-label]="'catalog.subcategories' | transloco">
              <ul class="flex flex-wrap gap-2">
                @for (hija of d.hijas; track hija.slug) {
                  <li>
                    <a
                      class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm hover:border-primary hover:text-primary"
                      [routerLink]="['/catalogo', hija.slug]"
                      [attr.data-track]="'categorias.' + hija.slug"
                    >{{ hija.clave_i18n | transloco }}</a>
                  </li>
                }
              </ul>
            </nav>
          }

          <div class="mt-6">
            @if (v.productos.length) {
              <app-listado-vista [productos]="v.productos" />
            } @else {
              <app-empty-state [titulo]="'catalog.emptyCategory.title' | transloco" [mensaje]="'catalog.emptyCategory.body' | transloco">
                @for (cat of raices(); track cat.slug) {
                  @if (cat.slug !== d.categoria.slug) {
                    <a class="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-medium hover:bg-surface-muted" [routerLink]="['/catalogo', cat.slug]">{{ cat.clave_i18n | transloco }}</a>
                  }
                }
                <button type="button" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" (click)="irAlBuscador()">{{ 'catalog.useSearch' | transloco }}</button>
              </app-empty-state>
            }
          </div>
        } @else {
          <app-empty-state [titulo]="'notFound.title' | transloco" [mensaje]="'notFound.body' | transloco">
            <a routerLink="/" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'catalog.toHome' | transloco }}</a>
          </app-empty-state>
        }
      } @else {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" [attr.aria-label]="'catalog.loading' | transloco">
          @for (n of esqueletos; track n) { <app-product-card-skeleton /> }
        </div>
      }
    </div>
  `,
})
export default class Categoria {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogApi);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);

  protected readonly esqueletos = Array.from({ length: 8 }, (_, i) => i);
  protected readonly raices = toSignal(this.catalog.categoriasRaiz(), { initialValue: [] });

  /**
   * `undefined` = cargando (esqueletos; con los datos en memoria no llega a verse). `paramMap` solo emite si cambia la categoría,
   * no con los filtros, el orden ni la página, que viven en los query params.
   */
  protected readonly vista = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug') ?? ''),
      switchMap((slug) =>
        this.catalog.categoria(slug).pipe(
          switchMap((detalle) =>
            detalle ? this.catalog.listadoDe(detalle.categoria.id).pipe(map((productos): Vista => ({ detalle, productos }))) : of<Vista>({ detalle: null, productos: [] }),
          ),
        ),
      ),
    ),
    { initialValue: undefined },
  );

  protected readonly migas = computed<Miga[]>(() => {
    const d = this.vista()?.detalle;
    if (!d) return [];
    return [
      { clave: 'catalog.home', ruta: ['/'] },
      ...(d.padre ? [{ clave: d.padre.clave_i18n, ruta: ['/catalogo', d.padre.slug] }] : []),
      { clave: d.categoria.clave_i18n },
    ];
  });

  private readonly nombre = translateSignal(computed(() => this.vista()?.detalle?.categoria.clave_i18n ?? 'notFound.title'));

  constructor() {
    // El título de la pestaña es el nombre de la categoría (CA-2.3).
    effect(() => this.title.setTitle(`${this.nombre()} · TechSuply`));
  }

  protected irAlBuscador(): void {
    enfocarBuscador(this.document);
  }
}
