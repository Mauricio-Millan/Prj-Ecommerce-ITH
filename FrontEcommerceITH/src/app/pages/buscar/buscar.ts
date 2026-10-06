import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { distinctUntilChanged, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { AddToCart } from '../../core/cart/add-to-cart';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { Categoria, Producto } from '../../core/catalog/catalog.models';
import { SearchApi } from '../../core/search/search.api';
import { InteractionLogger } from '../../core/telemetry/interaction-logger';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ProductCard } from '../../shared/ui/product-card/product-card';
import { enfocarBuscador } from '../../shared/util/focus-search';
import { ListadoVista } from '../listado/listado-vista';

interface Atajo {
  slug: string;
  clave: string;
  cantidad: number;
}

interface Vista {
  q: string;
  exacto: boolean;
  exacta: Producto | null;
  /** Los demás resultados, del más al menos relevante (sin la coincidencia exacta). */
  resultados: Producto[];
  total: number;
  interpretacion: string | null;
  atajos: Atajo[];
  /** Consultas parecidas que sí tienen resultados (solo cuando no hay ninguno). */
  parecidas: string[];
}

/** Resultados de búsqueda (spec 002). Los filtros, el orden y la paginación los pone el `listado-vista` compartido con las categorías. */
@Component({
  selector: 'app-buscar',
  imports: [NgTemplateOutlet, RouterLink, TranslocoPipe, EmptyState, ListadoVista, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6">
      @if (vista(); as v) {
        @if (!v.q) {
          <app-empty-state [titulo]="'search.empty.noQuery' | transloco" [mensaje]="'search.empty.tips' | transloco">
            <ng-container *ngTemplateOutlet="salidas" />
          </app-empty-state>
        } @else {
          <h1 class="text-2xl font-bold md:text-3xl">{{ 'search.title' | transloco: { q: v.q } }}</h1>
          @if (v.total) {
            <p class="mt-1 text-sm text-muted" aria-live="polite">{{ (v.total === 1 ? 'search.countOne' : 'search.count') | transloco: { n: v.total } }}</p>
          }

          <!-- Cómo se entendió la consulta, con salida a lo que escribió exactamente (CA-3.4, H1, H3). -->
          @if (v.interpretacion && !v.exacto) {
            <p class="mt-3 text-sm">
              {{ 'search.interpreted' | transloco: { q: v.interpretacion } }} ·
              <a
                data-track="resultados.buscar-exacto"
                class="font-semibold text-primary underline-offset-2 hover:underline"
                [routerLink]="[]"
                [queryParams]="{ exacto: 1, pagina: null }"
                queryParamsHandling="merge"
              >{{ 'search.exactSearch' | transloco: { q: v.q } }}</a>
            </p>
          }
          @if (v.exacto) {
            <p class="mt-3 text-sm">
              {{ 'search.exactNow' | transloco: { q: v.q } }} ·
              <a class="font-semibold text-primary underline-offset-2 hover:underline" [routerLink]="[]" [queryParams]="{ exacto: null, pagina: null }" queryParamsHandling="merge">{{ 'search.smartAgain' | transloco }}</a>
            </p>
          }

          @if (v.atajos.length > 1) {
            <nav class="mt-4" [attr.aria-label]="'search.categories' | transloco">
              <ul class="flex flex-wrap gap-2">
                @for (a of v.atajos; track a.slug) {
                  <li>
                    <button
                      type="button"
                      data-track="resultados.categoria"
                      class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm hover:border-primary hover:text-primary"
                      (click)="acotarPorCategoria(a.slug)"
                    >{{ a.clave | transloco }} ({{ a.cantidad }})</button>
                  </li>
                }
              </ul>
            </nav>
          }

          @if (v.exacta; as e) {
            <section class="mt-6" aria-labelledby="exacta">
              <h2 id="exacta" class="mb-2 inline-flex items-center rounded-full bg-success px-3 py-1 text-sm font-semibold text-primary-foreground">{{ 'search.exactMatch' | transloco }}</h2>
              <div class="max-w-xs"><app-product-card [producto]="e" [prioritaria]="true" (agregar)="agregar($event)" /></div>
            </section>
          }

          @if (v.total === 0) {
            <app-empty-state [titulo]="'search.empty.title' | transloco: { q: v.q }" [mensaje]="'search.empty.tips' | transloco">
              @if (v.parecidas.length) {
                <div class="w-full">
                  <p class="mb-2 text-sm font-medium">{{ 'search.empty.similar' | transloco }}</p>
                  <ul class="flex flex-wrap justify-center gap-2">
                    @for (p of v.parecidas; track p) {
                      <li><a class="inline-flex min-h-11 items-center rounded-full border border-primary px-4 text-sm font-medium text-primary hover:bg-surface-muted" [routerLink]="['/buscar']" [queryParams]="{ q: p }">{{ p }}</a></li>
                    }
                  </ul>
                </div>
              }
              <ng-container *ngTemplateOutlet="salidas" />
            </app-empty-state>
          } @else if (v.resultados.length) {
            @if (v.exacta) {
              <h2 class="mt-8 mb-2 text-xl font-semibold">{{ 'search.others' | transloco }}</h2>
            }
            <div class="mt-4"><app-listado-vista [productos]="v.resultados" [permitirRelevancia]="true" /></div>
          }
        }
      }
    </div>

    <ng-template #salidas>
      @for (cat of raices(); track cat.slug) {
        <a class="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-medium hover:bg-surface-muted" [routerLink]="['/catalogo', cat.slug]">{{ cat.clave_i18n | transloco }}</a>
      }
      <button type="button" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" (click)="irAlBuscador()">{{ 'catalog.useSearch' | transloco }}</button>
    </ng-template>
  `,
})
export default class Buscar {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly search = inject(SearchApi);
  private readonly catalog = inject(CatalogApi);
  private readonly addToCart = inject(AddToCart);
  private readonly logger = inject(InteractionLogger);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);

  protected readonly raices = toSignal(this.catalog.categoriasRaiz(), { initialValue: [] as Categoria[] });

  /**
   * Se busca solo cuando cambia la consulta o el modo exacto, no con los filtros, el orden ni la página (que viven en los
   * query params). Así `search` se registra UNA vez por búsqueda ejecutada (CA-6.2).
   */
  protected readonly vista = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => ({ q: (p.get('q') ?? '').trim(), exacto: p.get('exacto') === '1' })),
      distinctUntilChanged((a, b) => a.q === b.q && a.exacto === b.exacto),
      switchMap(({ q, exacto }) =>
        q
          ? this.search.buscar(q, { exacto }).pipe(
              switchMap((r) =>
                forkJoin({
                  categorias: this.catalog.categorias(),
                  parecidas: r.exacta || r.resultados.length ? of<string[]>([]) : this.search.sugerenciasSinResultados(q),
                }).pipe(
                  map(({ categorias, parecidas }): Vista => {
                    const todos = [...(r.exacta ? [r.exacta] : []), ...r.resultados.map((x) => x.producto)];
                    const cuenta = new Map<number, number>();
                    todos.forEach((p) => cuenta.set(p.categoria_id, (cuenta.get(p.categoria_id) ?? 0) + 1));
                    const atajos = [...cuenta]
                      .flatMap(([id, cantidad]) => {
                        const c = categorias.find((x) => x.id === id);
                        return c ? [{ slug: c.slug, clave: c.clave_i18n, cantidad }] : [];
                      })
                      .sort((a, b) => b.cantidad - a.cantidad);
                    return { q, exacto, exacta: r.exacta, resultados: r.resultados.map((x) => x.producto), total: todos.length, interpretacion: r.interpretacion, atajos, parecidas };
                  }),
                ),
              ),
            )
          : of<Vista>({ q: '', exacto, exacta: null, resultados: [], total: 0, interpretacion: null, atajos: [], parecidas: [] }),
      ),
      tap((v) => {
        if (v.q) this.logger.track('search', { q: v.q.slice(0, 100), resultados: v.total, exacta: v.exacta !== null, interpretada: v.interpretacion !== null });
      }),
    ),
    { initialValue: null },
  );

  private readonly tituloPestana = translateSignal('search.title', computed(() => ({ q: this.vista()?.q ?? '' })));

  constructor() {
    // "Resultados para «…» · TechSuply" (plan § 4.4).
    effect(() => this.title.setTitle(`${this.tituloPestana()} · TechSuply`));
  }

  /** Un clic aplica el filtro de subcategoría (`sub=`) y vuelve a la página 1 (CA-3.3). */
  protected acotarPorCategoria(slug: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { sub: slug, pagina: null }, queryParamsHandling: 'merge' });
  }

  protected agregar(producto: Producto): void {
    this.addToCart.agregar(producto, 1, 'tarjeta');
  }

  protected irAlBuscador(): void {
    enfocarBuscador(this.document);
  }
}
