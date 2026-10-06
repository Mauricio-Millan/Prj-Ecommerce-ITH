import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { combineLatest, map } from 'rxjs';
import { AddToCart } from '../../core/cart/add-to-cart';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { ordenar, paginar } from '../../core/catalog/catalog.logic';
import { Orden, Producto } from '../../core/catalog/catalog.models';
import { ContextoFiltros, Entrada, FILTROS_VACIOS, FiltrosActivos, aplicar, diferencia, entradas, facetas, quitarEntrada, quitarUltimo } from '../../core/catalog/filters.logic';
import { aUrl, desdeUrl } from '../../core/catalog/filters.url';
import { MiEquipoService } from '../../core/compat/mi-equipo.service';
import { CurrencyService } from '../../core/currency/currency.service';
import { LanguageService } from '../../core/i18n/language.service';
import { InteractionLogger } from '../../core/telemetry/interaction-logger';
import { ActiveFilters, ChipFiltro } from '../../shared/ui/active-filters/active-filters';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ContextoDrawer, FilterDrawer } from '../../shared/ui/filter-drawer/filter-drawer';
import { FilterPanel } from '../../shared/ui/filter-panel/filter-panel';
import { Icon } from '../../shared/ui/icon/icon';
import { MiEquipoTag } from '../../shared/ui/mi-equipo-tag/mi-equipo-tag';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { PriceNote } from '../../shared/ui/price-note/price-note';
import { ProductCard } from '../../shared/ui/product-card/product-card';
import { ORDENES, SortSelect } from '../../shared/ui/sort-select/sort-select';

const TAMANO = 12;

/**
 * Vista de listado COMPARTIDA por la categoría (001) y la búsqueda (002): los mismos filtros, orden y paginación en los dos
 * sitios (H4) y escritos una sola vez. El estado vive en la URL, así "Atrás" desde una ficha vuelve al mismo estado (CA-5.11).
 * Recibe los productos ya obtenidos; el orden `relevancia` conserva el orden en que llegan.
 */
@Component({
  selector: 'app-listado-vista',
  imports: [TranslocoPipe, ActiveFilters, FilterPanel, EmptyState, Icon, MiEquipoTag, Pagination, PriceNote, ProductCard, SortSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (productos().length) {
      <!-- Anuncia el cambio de resultados a los lectores de pantalla (accesibilidad). -->
      <p class="sr-only" aria-live="polite">{{ 'filters.count' | transloco: { n: filtrados().length } }}</p>

      @if (hayAplicables()) {
        <app-mi-equipo-tag [equipo]="equipoNombre() || null" (indicar)="abrirSelector()" (cambiar)="abrirSelector()" (quitar)="miEquipo.quitar()" class="mb-3 block" />
      }

      <app-active-filters [chips]="chips()" (quitar)="quitar($event)" (limpiar)="limpiar()" />

      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside class="hidden lg:block" [attr.aria-label]="'filters.title' | transloco">
          <app-filter-panel [facetas]="listaFacetas()" [activos]="activos()" [moneda]="moneda()" [tc]="tc()" [invitarEquipo]="invitarEquipo()" (cambio)="cambiarFiltros($event)" (indicarEquipo)="abrirSelector()" />
        </aside>

        <div>
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p class="text-sm">
              @if (filtrados().length) {
                {{ 'catalog.showing' | transloco: { desde: desde(), hasta: hasta(), total: filtrados().length } }}
                <app-price-note class="ml-2" />
              }
            </p>
            <div class="flex items-center gap-2">
              <!-- Solo en el celular: abre el panel lateral con los filtros (CA-5.10). -->
              <button
                type="button"
                data-track="filtros.abrir"
                class="inline-flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-sm font-semibold hover:bg-surface-muted lg:hidden"
                (click)="abrirFiltros()"
              >
                <app-icon name="filtrar" [size]="18" />
                {{ (chips().length ? 'filters.withCount' : 'filters.filter') | transloco: { n: chips().length } }}
              </button>
              <app-sort-select [valor]="orden()" [opciones]="opcionesOrden()" (cambiar)="cambiarOrden($event)" />
            </div>
          </div>

          @if (filtrados().length) {
            <div data-zone="resultados" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              @for (p of pagina().items; track p.sku; let i = $index) {
                <app-product-card [producto]="p" [prioritaria]="i < 4" [compat]="miEquipo.evaluar(p)" (agregar)="agregar($event)" />
              }
            </div>
            <div class="mt-8">
              <app-pagination [pagina]="pagina().pagina" [total]="pagina().total" [tamano]="pagina().tamano" (cambiar)="cambiarPagina($event)" />
            </div>
          } @else {
            <!-- Los filtros dejaron la lista vacía: se dice y se ofrece una salida (CA-4.2, H3). -->
            <app-empty-state [titulo]="'filters.noMatch.title' | transloco" [mensaje]="'filters.noMatch.body' | transloco">
              <button type="button" data-track="filtros.quitar" class="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" (click)="quitarUltimoFiltro()">
                {{ 'filters.noMatch.removeLast' | transloco }}
              </button>
              <button type="button" data-track="filtros.limpiar" class="min-h-11 rounded-control border border-border px-4 text-sm font-semibold hover:bg-surface-muted" (click)="limpiar()">
                {{ 'filters.clearAll' | transloco }}
              </button>
            </app-empty-state>
          }
        </div>
      </div>
    }
  `,
})
export class ListadoVista {
  readonly productos = input.required<Producto[]>();
  /** En la búsqueda existe "Más relevantes" y es el orden por defecto (CA-3.2). */
  readonly permitirRelevancia = input(false);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogApi);
  private readonly addToCart = inject(AddToCart);
  private readonly logger = inject(InteractionLogger);
  private readonly currency = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;
  private readonly transloco = inject(TranslocoService);
  protected readonly miEquipo = inject(MiEquipoService);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  private readonly ctx = toSignal(
    combineLatest([this.catalog.categorias(), this.catalog.marcas(), this.catalog.atributos()]).pipe(
      map(([categorias, marcas, atributos]): ContextoFiltros => ({ categorias, marcas, atributos })),
    ),
    { initialValue: { categorias: [], marcas: [], atributos: [] } as ContextoFiltros },
  );
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly moneda = computed(() => this.currency.currency());
  protected readonly tc = computed(() => {
    const v = this.currency.exchangeRate();
    return v ? Number(v.valor) : null;
  });

  protected readonly equipoNombre = this.miEquipo.nombre;
  protected readonly hayAplicables = computed(() => this.productos().some((p) => this.miEquipo.aplica(p)));
  protected readonly invitarEquipo = computed(() => !this.miEquipo.equipo() && this.hayAplicables());

  /** Contexto de los filtros + la compatibilidad (spec 003, CA-3.1). */
  private readonly ctxFiltros = computed<ContextoFiltros>(() => ({
    ...this.ctx(),
    compat: {
      hayEquipo: this.miEquipo.equipo() !== null,
      aplica: (p) => this.miEquipo.aplica(p),
      compatible: (p) => this.miEquipo.evaluar(p)?.estado === 'compatible',
    },
  }));

  protected readonly activos = computed(() => {
    const a = desdeUrl(this.query(), this.ctx().atributos);
    return this.miEquipo.equipo() ? a : { ...a, compatible: undefined };
  });
  protected readonly opcionesOrden = computed<readonly Orden[]>(() => (this.permitirRelevancia() ? ['relevancia', ...ORDENES] : ORDENES));
  protected readonly orden = computed<Orden>(() => {
    const pedido = this.query().get('orden') as Orden | null;
    return pedido && this.opcionesOrden().includes(pedido) ? pedido : this.opcionesOrden()[0];
  });

  protected readonly listaFacetas = computed(() => facetas(this.productos(), this.ctxFiltros(), this.activos()));
  protected readonly filtrados = computed(() => aplicar(this.productos(), this.activos(), this.ctxFiltros()));
  protected readonly pagina = computed(() => paginar(ordenar(this.filtrados(), this.orden()), Number(this.query().get('pagina')) || 1, TAMANO));
  protected readonly desde = computed(() => (this.pagina().pagina - 1) * TAMANO + 1);
  protected readonly hasta = computed(() => Math.min(this.pagina().pagina * TAMANO, this.pagina().total));

  private readonly claves = computed(() => [...new Set(this.ctx().atributos.map((a) => a.clave))]);

  /** Cada filtro aplicado como etiqueta, con el precio en la moneda activa (CA-5.7). */
  protected readonly chips = computed<ChipFiltro[]>(() => {
    this.lang(); // el texto de los rangos depende del idioma
    const { categorias, marcas, atributos } = this.ctx();
    const factor = this.moneda() === 'PEN' && this.tc() ? this.tc()! : 1;
    const simbolo = this.moneda() === 'PEN' && this.tc() ? 'S/' : '$';
    const nombreAtributo = (clave: string) => atributos.find((a) => a.clave === clave);
    const rango = (valor: string, f: (n: number) => string) => {
      const [min, max] = valor.split('-');
      return min && max ? `${f(Number(min))} – ${f(Number(max))}` : min ? `≥ ${f(Number(min))}` : `≤ ${f(Number(max))}`;
    };

    return entradas(this.activos()).map<ChipFiltro>((e) => {
      const base = { id: e.id, valor: e.valor };
      if (e.id === 'sub') return { ...base, clave: categorias.find((c) => c.slug === e.valor)?.clave_i18n ?? e.valor };
      if (e.id === 'marca') return { ...base, texto: marcas.find((m) => m.id === Number(e.valor))?.nombre ?? e.valor };
      if (e.id === 'precio') return { ...base, texto: rango(e.valor, (n) => `${simbolo} ${Number((n * factor).toFixed(2))}`) };
      if (e.id === 'disp') return { ...base, clave: 'filters.availability' };
      if (e.id === 'compat') return { ...base, texto: this.transloco.translate('compat.chip', { equipo: this.miEquipo.equipo()?.modelo ?? '' }) };
      const at = nombreAtributo(e.id);
      if (e.valor.includes('-') && at?.tipo === 'numero') return { ...base, prefijoClave: at.clave_i18n, texto: `${rango(e.valor, String)}${at.unidad ? ' ' + at.unidad : ''}` };
      if (e.valor === '1' && at?.tipo === 'booleano') return { ...base, clave: at.clave_i18n };
      return { ...base, texto: e.valor };
    });
  });

  private irA(params: Record<string, string | number | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }

  /** Al cambiar un filtro se vuelve a la página 1 (CA-5.8) y se registra qué cambió y cuántos resultados quedaron (CA-6.3). */
  protected cambiarFiltros(nuevos: FiltrosActivos): void {
    const resultados = aplicar(this.productos(), nuevos, this.ctxFiltros()).length;
    for (const d of diferencia(this.activos(), nuevos)) {
      this.logger.track('filter', { atributo: d.id, valor: d.valor, accion: d.accion, resultados });
    }
    this.irA({ ...aUrl(nuevos, this.claves()), pagina: null });
  }

  protected quitar(chip: ChipFiltro): void {
    const e: Entrada = { id: chip.id, valor: chip.valor };
    this.cambiarFiltros(quitarEntrada(this.activos(), e));
  }

  protected limpiar(): void {
    this.cambiarFiltros(FILTROS_VACIOS);
  }

  protected quitarUltimoFiltro(): void {
    this.cambiarFiltros(quitarUltimo(this.activos()));
  }

  protected cambiarOrden(orden: Orden): void {
    this.irA({ orden: orden === this.opcionesOrden()[0] ? null : orden, pagina: null });
  }

  protected cambiarPagina(pagina: number): void {
    this.irA({ pagina: pagina === 1 ? null : pagina });
  }

  protected agregar(producto: Producto): void {
    this.addToCart.agregar(producto, 1, 'tarjeta');
  }

  protected abrirSelector(): void {
    this.miEquipo.abrirSelector();
  }

  protected abrirFiltros(): void {
    const datos: ContextoDrawer = {
      facetas: this.listaFacetas,
      activos: this.activos,
      moneda: this.moneda,
      tc: this.tc,
      total: computed(() => this.filtrados().length),
      invitarEquipo: this.invitarEquipo,
      indicarEquipo: () => this.abrirSelector(),
      cambiar: (a) => this.cambiarFiltros(a),
    };
    this.dialog.open(FilterDrawer, {
      data: datos,
      ariaLabelledBy: 'filtros-titulo',
      positionStrategy: this.overlay.position().global().right('0').top('0'),
      height: '100%',
      width: 'min(24rem, 90vw)',
    });
  }
}
