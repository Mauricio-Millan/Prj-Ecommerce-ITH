import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AddToCart } from '../../core/cart/add-to-cart';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { Producto } from '../../core/catalog/catalog.models';
import { MiEquipoService } from '../../core/compat/mi-equipo.service';
import { SearchBox } from '../../layouts/store-layout/search-box/search-box';
import { Icon } from '../../shared/ui/icon/icon';
import { ProductCard } from '../../shared/ui/product-card/product-card';

/**
 * Inicio (HU-1). Patrón Z (constitución P1): logo y buscador (en el encabezado) → mensaje principal → botón de acción.
 * El buscador destacado del hero llega con la spec 002 (reusará el del encabezado).
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, Icon, ProductCard, SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-7xl px-4 py-12 md:py-20">
      <h1 class="max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">{{ 'home.title' | transloco }}</h1>
      <p class="mt-4 max-w-xl text-lg text-muted">{{ 'home.subtitle' | transloco }}</p>
      <!-- Buscador destacado del hero (HU-1): el mismo componente que el del encabezado, con su propio id. -->
      <app-search-box inputId="buscador-inicio" [destacado]="true" class="mt-6 max-w-2xl" />
      <a
        routerLink="/"
        fragment="destacados"
        data-zone="cta-principal"
        data-track="cta-principal.ver-destacados"
        class="mt-8 inline-flex min-h-12 items-center rounded-control bg-accent px-6 font-semibold text-accent-foreground hover:opacity-90"
      >{{ 'home.cta' | transloco }}</a>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-12" aria-labelledby="home-categorias">
      <h2 id="home-categorias" class="mb-4 text-xl font-semibold">{{ 'header.categories' | transloco }}</h2>
      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" data-zone="categorias">
        @for (cat of categorias(); track cat.slug) {
          <li>
            <a
              class="flex min-h-20 items-center gap-3 rounded-card border border-border bg-surface p-4 font-medium shadow-card hover:border-primary"
              [routerLink]="['/catalogo', cat.slug]"
              [attr.data-track]="'categorias.' + cat.slug"
            >
              <span class="inline-flex rounded-control bg-surface-muted p-2 text-primary"><app-icon [name]="cat.icono" [size]="24" /></span>
              {{ cat.clave_i18n | transloco }}
            </a>
          </li>
        }
      </ul>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-12" aria-labelledby="home-armador">
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-card border border-primary bg-surface p-6 shadow-card">
        <div class="max-w-xl">
          <h2 id="home-armador" class="text-xl font-semibold">{{ 'builder.homeTitle' | transloco }}</h2>
          <p class="mt-1 text-muted">{{ 'builder.homeBody' | transloco }}</p>
        </div>
        <a routerLink="/armador" data-track="armador.abrir" class="inline-flex min-h-12 items-center rounded-control bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'builder.nav' | transloco }}</a>
      </div>
    </section>

    <section id="destacados" class="mx-auto max-w-7xl scroll-mt-32 px-4 pb-16" aria-labelledby="home-destacados">
      <h2 id="home-destacados" class="mb-4 text-xl font-semibold">{{ 'home.featured' | transloco }}</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (p of destacados(); track p.sku) {
          <app-product-card [producto]="p" [compat]="miEquipo.evaluar(p)" (agregar)="agregar($event)" />
        }
      </div>
    </section>
  `,
})
export default class Home {
  private readonly catalog = inject(CatalogApi);
  private readonly addToCart = inject(AddToCart);
  protected readonly miEquipo = inject(MiEquipoService);

  protected readonly categorias = toSignal(this.catalog.categoriasRaiz(), { initialValue: [] });
  /** Máximo 8, con el mismo formato de tarjeta del listado (CA-1.2). */
  protected readonly destacados = toSignal(this.catalog.destacados(8), { initialValue: [] });

  constructor() {
    inject(Title).setTitle('TechSuply');
  }

  protected agregar(producto: Producto): void {
    this.addToCart.agregar(producto, 1, 'tarjeta');
  }
}
