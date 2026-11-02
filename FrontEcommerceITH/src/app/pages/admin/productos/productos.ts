import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EstadoAdmin, FiltroAdmin, estadoAdmin, filtrarProductosAdmin } from '../../../core/admin/producto.logic';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { paginar } from '../../../core/catalog/catalog.logic';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { CAMPO } from '../../../shared/ui/form-classes';

const TAMANO = 15;
type EstadoFiltro = FiltroAdmin['estado'];
const ESTADOS: EstadoFiltro[] = ['todos', 'activo', 'oculto', 'agotado', 'pocas'];

/** Lista de productos del panel (spec 009, HU-1): todos, también los ocultos, con el estado escrito. */
@Component({
  selector: 'app-productos-admin',
  imports: [RouterLink, TranslocoPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-productos" class="mx-auto grid max-w-5xl gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-2xl font-bold">{{ 'adminProduct.list.title' | transloco }}</h1>
        <a routerLink="/admin/productos/nuevo" data-track="admin.producto-nuevo" class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'adminProduct.list.new' | transloco }}</a>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="grid gap-1 sm:col-span-3">
          <label for="ap-q" class="text-sm font-semibold">{{ 'adminProduct.list.search' | transloco }}</label>
          <input id="ap-q" type="search" [class]="campo" [value]="q()" [placeholder]="'adminProduct.list.searchPlaceholder' | transloco" (input)="q.set($any($event.target).value); pagina.set(1)" />
        </div>
        <div class="grid gap-1">
          <label for="ap-cat" class="text-sm font-semibold">{{ 'adminProduct.list.category' | transloco }}</label>
          <select id="ap-cat" [class]="campo" (change)="categoriaId.set(+$any($event.target).value || null); pagina.set(1)">
            <option value="">{{ 'adminProduct.list.allCategories' | transloco }}</option>
            @for (g of grupos(); track g.raiz.id) {
              <option [value]="g.raiz.id" [selected]="categoriaId() === g.raiz.id">{{ g.raiz.clave_i18n | transloco }}</option>
              @for (h of g.hijas; track h.id) {
                <option [value]="h.id" [selected]="categoriaId() === h.id">— {{ h.clave_i18n | transloco }}</option>
              }
            }
          </select>
        </div>
        <div class="grid gap-1">
          <label for="ap-estado" class="text-sm font-semibold">{{ 'adminProduct.list.status' | transloco }}</label>
          <select id="ap-estado" [class]="campo" (change)="estado.set($any($event.target).value); pagina.set(1)">
            @for (e of estados; track e) {
              <option [value]="e" [selected]="estado() === e">{{ 'adminProduct.status.' + e | transloco }}</option>
            }
          </select>
        </div>
      </div>

      <p role="status" class="text-sm text-muted">{{ 'adminProduct.list.count' | transloco: { n: filtrados().length } }}</p>

      @if (pag().items.length) {
        <ul class="grid gap-2" [attr.aria-label]="'adminProduct.list.title' | transloco">
          @for (p of pag().items; track p.id) {
            <li class="flex flex-wrap items-center gap-3 rounded-card border border-border p-3">
              <img [src]="p.imagenes[0]?.url" alt="" width="56" height="56" class="size-14 shrink-0 rounded-control bg-surface-muted object-cover" />
              <div class="min-w-0 flex-1 basis-48">
                <p class="line-clamp-2 text-sm font-semibold">{{ p.nombre }}</p>
                <p class="text-xs text-muted">{{ p.sku }} · {{ nombreCategoria(p.categoria_id) | transloco }}</p>
              </div>
              <p class="text-sm">US$ {{ p.precio_usd | number: '1.2-2' }}</p>
              <p class="text-sm">{{ 'adminProduct.list.stock' | transloco: { n: p.stock } }}</p>
              <p class="rounded-control border border-border px-2 py-1 text-xs font-semibold">{{ 'adminProduct.status.' + estadoDe(p) | transloco }}</p>
              <div class="flex gap-2">
                <a [routerLink]="['/admin/productos', p.sku]" data-track="admin.producto-editar" class="inline-flex min-h-11 items-center rounded-control border border-border-control px-3 text-sm font-semibold hover:bg-surface-muted">{{ 'adminProduct.list.edit' | transloco }}</a>
                <a [routerLink]="['/producto', p.sku]" class="inline-flex min-h-11 items-center px-2 text-sm text-primary underline">{{ 'adminProduct.list.view' | transloco }}</a>
              </div>
            </li>
          }
        </ul>
        @if (pag().total > tamano) {
          <nav class="flex items-center justify-between gap-2" [attr.aria-label]="'adminProduct.list.pages' | transloco">
            <button type="button" class="min-h-11 rounded-control border border-border-control px-4 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="pagina() === 1" (click)="pagina.set(pagina() - 1)">{{ 'adminProduct.list.prev' | transloco }}</button>
            <span class="text-sm">{{ 'adminProduct.list.page' | transloco: { n: pagina(), total: paginas() } }}</span>
            <button type="button" class="min-h-11 rounded-control border border-border-control px-4 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="pagina() >= paginas()" (click)="pagina.set(pagina() + 1)">{{ 'adminProduct.list.next' | transloco }}</button>
          </nav>
        }
      } @else {
        <p class="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">{{ 'adminProduct.list.empty' | transloco }}</p>
      }
    </div>
  `,
})
export default class ProductosAdmin {
  private readonly datos = inject(CatalogApi).adminDatos();
  private readonly consulta = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly campo = CAMPO;
  protected readonly tamano = TAMANO;
  protected readonly estados = ESTADOS;
  protected readonly q = signal(this.consulta.get('q') ?? '');
  protected readonly categoriaId = signal<number | null>(Number(this.consulta.get('categoria')) || null);
  protected readonly estado = signal<EstadoFiltro>(ESTADOS.includes(this.consulta.get('estado') as EstadoFiltro) ? (this.consulta.get('estado') as EstadoFiltro) : 'todos');
  protected readonly pagina = signal(1);

  protected readonly grupos = computed(() =>
    this.datos.categorias.filter((c) => c.padre_id === null).sort((a, b) => a.orden - b.orden).map((raiz) => ({ raiz, hijas: this.datos.categorias.filter((h) => h.padre_id === raiz.id).sort((a, b) => a.orden - b.orden) })),
  );
  protected readonly filtrados = computed(() =>
    filtrarProductosAdmin(this.datos.productos, this.datos.categorias, { q: this.q(), categoriaId: this.categoriaId(), estado: this.estado() }).sort((a, b) => b.id - a.id),
  );
  protected readonly pag = computed(() => paginar(this.filtrados(), this.pagina(), TAMANO));
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / TAMANO)));

  constructor() {
    tituloDePagina('adminProduct.list.title');
  }

  protected estadoDe = (p: Parameters<typeof estadoAdmin>[0]): EstadoAdmin => estadoAdmin(p);
  protected nombreCategoria = (id: number): string => this.datos.categorias.find((c) => c.id === id)?.clave_i18n ?? '';
}
