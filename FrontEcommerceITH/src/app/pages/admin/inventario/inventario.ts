import { ChangeDetectionStrategy, Component, HostListener, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { Producto } from '../../../core/catalog/catalog.models';
import { InventarioApi } from '../../../core/inventory/inventory.api';
import { LineaInventario, MOTIVOS, ModoInventario, MotivoAjuste, diferencia, sumarEscaneo } from '../../../core/inventory/inventory.logic';
import { DetectorLector } from '../../../core/scan/lector-usb';
import { ScanService } from '../../../core/scan/scan.service';
import { SearchApi } from '../../../core/search/search.api';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';

type Pestana = ModoInventario | 'historial';
type Fuente = 'camara' | 'lector_usb' | 'manual';

const RESALTE_MS = 1200;

/**
 * Inventario con escáner (spec 015). Se trabaja en un borrador (lista de líneas) y NADA cambia hasta confirmar el resumen (H5).
 * El campo de escaneo conserva el foco para que un lector USB funcione sin tocar nada (CA-1.2, 4.2).
 */
@Component({
  selector: 'app-inventario',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div data-zone="inventario" class="mx-auto grid max-w-3xl gap-4">
      <h1 class="text-2xl font-bold">{{ 'inventory.title' | transloco }}</h1>

      <div role="group" [attr.aria-label]="'inventory.modesLabel' | transloco" class="flex flex-wrap gap-2">
        @for (p of pestanas; track p) {
          <button
            type="button"
            [attr.data-track]="'inventario.modo-' + p"
            [attr.aria-pressed]="pestana() === p"
            class="inline-flex min-h-11 items-center gap-2 rounded-control border px-4 text-sm font-semibold"
            [class]="pestana() === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border-control hover:bg-surface-muted'"
            (click)="cambiar(p)"
          >
            @if (pestana() === p) {
              <app-icon name="copiado" [size]="16" />
            }
            {{ 'inventory.modes.' + p | transloco }}
          </button>
        }
      </div>

      @if (pestana() !== 'historial') {
        <p class="text-sm text-muted">{{ 'inventory.help.' + pestana() | transloco }}</p>

        <form class="flex gap-2" (submit)="enviar($event)">
          <label for="inv-escaneo" class="sr-only">{{ 'inventory.scanLabel' | transloco }}</label>
          <input
            id="inv-escaneo"
            #campo
            type="text"
            autocomplete="off"
            autofocus
            class="min-h-11 min-w-0 flex-1 rounded-control border border-border-control bg-surface px-3 text-sm placeholder:text-muted"
            [placeholder]="'inventory.scanPlaceholder' | transloco"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
            (keydown)="alTeclear($event)"
          />
          <button type="submit" data-track="inventario.agregar" class="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'inventory.add' | transloco }}</button>
          @if (escaner.disponible) {
            <button type="button" data-track="inventario.escanear-camara" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border-control hover:bg-surface-muted" [attr.aria-label]="'inventory.scanCamera' | transloco" (click)="escanearConCamara()">
              <app-icon name="escanear" />
            </button>
          }
        </form>

        @if (sinCoincidencia(); as s) {
          <div role="alert" class="grid gap-2 rounded-card border border-border bg-surface-muted p-3 text-sm">
            <p class="flex items-center gap-2 font-semibold"><app-icon name="advertencia" [size]="20" /> {{ 'inventory.unknown' | transloco }}</p>
            @if (s.sugerencias.length) {
              <p class="text-muted">{{ 'inventory.pick' | transloco }}</p>
              <ul class="grid gap-1">
                @for (p of s.sugerencias; track p.sku) {
                  <li><button type="button" class="min-h-11 w-full rounded-control border border-border px-3 text-left hover:bg-surface" (click)="agregar(p.sku, 'manual')">{{ p.nombre }}</button></li>
                }
              </ul>
            } @else {
              <button type="button" data-track="inventario.buscar-nombre" class="min-h-11 justify-self-start rounded-control border border-border-control px-3 font-semibold hover:bg-surface" (click)="buscarPorNombre(s.codigo)">{{ 'inventory.searchByName' | transloco }}</button>
            }
            <button type="button" data-track="inventario.escanear-otro" class="min-h-11 justify-self-start rounded-control border border-border-control px-3 font-semibold hover:bg-surface" (click)="sinCoincidencia.set(null); enfocar()">{{ 'inventory.scanAnother' | transloco }}</button>
          </div>
        }

        @if (!lineas().length) {
          <p class="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">{{ 'inventory.empty' | transloco }}</p>
        } @else if (!enResumen()) {
          <ul class="grid gap-2" [attr.aria-label]="'inventory.linesLabel' | transloco">
            @for (l of vista(); track l.sku) {
              <li class="grid gap-2 rounded-card border p-3" [class]="l.sku === resaltado() ? 'border-primary bg-surface-muted' : 'border-border'">
                <div class="flex items-center gap-3">
                  <img [src]="l.producto.imagenes[0]?.url" alt="" width="48" height="48" class="size-12 shrink-0 rounded-control bg-surface-muted object-cover" />
                  <div class="min-w-0 flex-1">
                    <p class="line-clamp-2 text-sm font-semibold">{{ l.producto.nombre }}</p>
                    <p class="text-xs text-muted">{{ l.producto.sku }} · {{ 'inventory.line.stock' | transloco: { n: l.producto.stock } }}</p>
                  </div>
                  <button type="button" data-track="inventario.quitar" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'inventory.line.remove' | transloco: { nombre: l.producto.nombre }" (click)="quitar(l.sku)">
                    <app-icon name="eliminar" />
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="min-h-11 min-w-11 rounded-control border border-border-control text-lg hover:bg-surface-muted" [attr.aria-label]="'inventory.line.minus' | transloco: { nombre: l.producto.nombre }" (click)="fijar(l.sku, l.cantidad - 1)">−</button>
                  <label class="sr-only" [for]="'inv-cant-' + l.sku">{{ (pestana() === 'conteo' ? 'inventory.line.counted' : 'inventory.line.qty') | transloco }}: {{ l.producto.nombre }}</label>
                  <input [id]="'inv-cant-' + l.sku" type="number" inputmode="numeric" min="0" step="1" class="min-h-11 w-20 rounded-control border border-border-control bg-surface px-2 text-center text-sm" [value]="l.cantidad" (change)="fijar(l.sku, +$any($event.target).value)" />
                  <button type="button" class="min-h-11 min-w-11 rounded-control border border-border-control text-lg hover:bg-surface-muted" [attr.aria-label]="'inventory.line.plus' | transloco: { nombre: l.producto.nombre }" (click)="fijar(l.sku, l.cantidad + 1)">+</button>
                  @if (pestana() === 'conteo') {
                    <span class="text-sm" [class.font-semibold]="l.dif !== 0">
                      {{ 'inventory.line.system' | transloco: { n: l.producto.stock } }} ·
                      {{ (l.dif > 0 ? 'inventory.diff.over' : l.dif < 0 ? 'inventory.diff.under' : 'inventory.diff.none') | transloco: { n: abs(l.dif) } }}
                    </span>
                  }
                </div>
              </li>
            }
          </ul>

          <div class="flex flex-wrap gap-2">
            <button type="button" data-track="inventario.confirmar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="irAlResumen()">{{ (pestana() === 'conteo' ? 'inventory.confirmCount' : 'inventory.confirmEntry') | transloco }}</button>
            <button type="button" data-track="inventario.deshacer-escaneo" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="!ultimo()" (click)="deshacer()">{{ 'inventory.undo' | transloco }}</button>
          </div>
        } @else {
          <section class="grid gap-3 rounded-card border border-border p-4" aria-labelledby="inv-resumen-titulo">
            <h2 id="inv-resumen-titulo" class="text-lg font-semibold">{{ 'inventory.summary.title' | transloco }}</h2>
            <p>{{ 'inventory.summary.products' | transloco: { n: lineas().length } }} · {{ 'inventory.summary.units' | transloco: { n: unidades() } }}</p>
            @if (pestana() === 'conteo' && hayDiferencias()) {
              <div class="grid gap-1">
                <label for="inv-motivo" class="text-sm font-semibold">{{ 'inventory.reason.label' | transloco }}</label>
                <select id="inv-motivo" class="min-h-11 rounded-control border border-border-control bg-surface px-3 text-sm" (change)="motivo.set($any($event.target).value || null)">
                  <option value="">{{ 'inventory.reason.choose' | transloco }}</option>
                  @for (m of motivos; track m) {
                    <option [value]="m" [selected]="m === motivo()">{{ 'inventory.reason.' + m | transloco }}</option>
                  }
                </select>
              </div>
            }
            @if (error(); as e) {
              <p role="alert" class="flex items-center gap-2 font-semibold text-danger"><app-icon name="advertencia" [size]="20" /> {{ 'inventory.error.' + e.codigo | transloco }}@if (e.sku) { ({{ e.sku }}) }</p>
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" data-track="inventario.confirmar-resumen" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="confirmar()">{{ 'inventory.summary.confirm' | transloco }}</button>
              <button type="button" data-track="inventario.volver" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="enResumen.set(false); error.set(null)">{{ 'inventory.summary.back' | transloco }}</button>
            </div>
          </section>
        }
      } @else {
        <section class="grid gap-3" data-track="inventario.historial" aria-labelledby="inv-hist-titulo">
          <h2 id="inv-hist-titulo" class="text-lg font-semibold">{{ 'inventory.history.title' | transloco }}</h2>
          <div class="flex flex-wrap gap-3">
            <div class="grid gap-1">
              <label for="inv-f-producto" class="text-sm font-semibold">{{ 'inventory.history.filterProduct' | transloco }}</label>
              <select id="inv-f-producto" class="min-h-11 rounded-control border border-border-control bg-surface px-3 text-sm" (change)="filtroSku.set($any($event.target).value)">
                <option value="">{{ 'inventory.history.all' | transloco }}</option>
                @for (s of skusConMovimientos(); track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </div>
            <div class="grid gap-1">
              <label for="inv-f-tipo" class="text-sm font-semibold">{{ 'inventory.history.filterType' | transloco }}</label>
              <select id="inv-f-tipo" class="min-h-11 rounded-control border border-border-control bg-surface px-3 text-sm" (change)="filtroTipo.set($any($event.target).value)">
                <option value="">{{ 'inventory.history.all' | transloco }}</option>
                <option value="ingreso">{{ 'inventory.history.type.ingreso' | transloco }}</option>
                <option value="ajuste">{{ 'inventory.history.type.ajuste' | transloco }}</option>
              </select>
            </div>
          </div>
          <p role="status" class="text-sm text-muted">{{ 'inventory.history.count' | transloco: { n: movimientos().length } }}</p>
          @if (movimientos().length) {
            <div class="overflow-x-auto rounded-card border border-border">
              <table class="w-full min-w-[40rem] text-left text-sm">
                <caption class="sr-only">{{ 'inventory.history.title' | transloco }}</caption>
                <thead class="bg-surface-muted">
                  <tr>
                    @for (c of columnas; track c) {
                      <th scope="col" class="px-3 py-2 font-semibold">{{ 'inventory.history.cols.' + c | transloco }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (m of movimientos(); track m.id) {
                    <tr class="border-t border-border">
                      <th scope="row" class="px-3 py-2 font-normal">{{ fecha(m.creado_en) }}</th>
                      <td class="px-3 py-2">{{ m.sku }}</td>
                      <td class="px-3 py-2">{{ 'inventory.history.type.' + m.tipo | transloco }}</td>
                      <td class="px-3 py-2">{{ m.cantidad > 0 ? '+' : '' }}{{ m.cantidad }}</td>
                      <td class="px-3 py-2">{{ m.stock_antes }}</td>
                      <td class="px-3 py-2">{{ m.stock_despues }}</td>
                      <td class="px-3 py-2">{{ m.motivo ? ('inventory.reason.' + m.motivo | transloco) : '—' }}</td>
                      <td class="px-3 py-2">{{ m.usuario }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-sm text-muted">{{ 'inventory.history.empty' | transloco }}</p>
          }
        </section>
      }

      <p class="sr-only" role="status" aria-live="polite">{{ anuncio() }}</p>
    </div>
  `,
})
export class Inventario {
  private readonly catalogo = inject(CatalogApi);
  private readonly api = inject(InventarioApi);
  private readonly i18n = inject(TranslocoService);
  private readonly logger = inject(InteractionLogger);
  private readonly toast = inject(ToastService);
  private readonly busqueda = inject(SearchApi);
  protected readonly escaner = inject(ScanService);
  private readonly lector = new DetectorLector();

  protected readonly pestanas: Pestana[] = ['ingreso', 'conteo', 'historial'];
  protected readonly motivos = MOTIVOS;
  protected readonly columnas = ['date', 'product', 'type', 'qty', 'before', 'after', 'reason', 'user'];

  protected readonly pestana = signal<Pestana>('ingreso');
  protected readonly texto = signal('');
  protected readonly ingreso = signal<LineaInventario[]>([]);
  protected readonly conteo = signal<LineaInventario[]>([]);
  protected readonly enResumen = signal(false);
  protected readonly motivo = signal<MotivoAjuste | null>(null);
  protected readonly error = signal<{ codigo: string; sku?: string } | null>(null);
  protected readonly resaltado = signal('');
  protected readonly ultimo = signal<string | null>(null);
  protected readonly anuncio = signal('');
  protected readonly sinCoincidencia = signal<{ codigo: string; sugerencias: Producto[] } | null>(null);
  protected readonly filtroSku = signal('');
  protected readonly filtroTipo = signal('');
  private inicio = 0;
  /** Cambia al confirmar para releer el stock del catálogo (`ts_catalogo`). */
  private readonly version = signal(0);

  private readonly productos = computed(() => {
    this.version();
    let lista: readonly Producto[] = [];
    this.catalogo.todos().subscribe((p) => (lista = p)).unsubscribe();
    return lista;
  });

  protected readonly lineas = computed(() => (this.pestana() === 'conteo' ? this.conteo() : this.ingreso()));
  protected readonly vista = computed(() => {
    const por = new Map(this.productos().map((p) => [p.sku, p]));
    return this.lineas().flatMap((l) => {
      const producto = por.get(l.sku);
      return producto ? [{ ...l, producto, dif: diferencia(l.cantidad, producto.stock) }] : [];
    });
  });
  protected readonly unidades = computed(() => this.lineas().reduce((s, l) => s + l.cantidad, 0));
  protected readonly hayDiferencias = computed(() => this.vista().some((l) => l.dif !== 0));

  protected readonly skusConMovimientos = computed(() => [...new Set(this.api.movimientos().map((m) => m.sku))].sort());
  protected readonly movimientos = computed(() =>
    this.api.movimientos().filter((m) => (!this.filtroSku() || m.sku === this.filtroSku()) && (!this.filtroTipo() || m.tipo === this.filtroTipo())),
  );

  protected readonly abs = Math.abs;

  constructor() {
    afterNextRender(() => this.enfocar()); // el lector USB funciona sin tocar nada (CA-1.2)
  }

  protected fecha = (iso: string) => new Date(iso).toLocaleString(this.i18n.getActiveLang());

  /** Hay un ingreso o conteo sin confirmar (CA-1.7). */
  hayPendientes = () => this.ingreso().length > 0 || this.conteo().length > 0;

  @HostListener('window:beforeunload', ['$event'])
  protected alRecargar(e: BeforeUnloadEvent): void {
    if (this.hayPendientes()) e.preventDefault();
  }

  protected cambiar(p: Pestana): void {
    this.pestana.set(p);
    this.enResumen.set(false);
    this.error.set(null);
    this.sinCoincidencia.set(null);
    if (p !== 'historial') queueMicrotask(() => this.enfocar());
  }

  protected enfocar(): void {
    document.getElementById('inv-escaneo')?.focus();
  }

  protected alTeclear(e: KeyboardEvent): void {
    const leido = this.lector.tecla(e.key, e.timeStamp);
    if (leido) {
      e.preventDefault();
      this.texto.set('');
      void this.leer(leido, 'lector_usb');
    }
  }

  protected enviar(e: Event): void {
    e.preventDefault();
    const valor = this.texto().trim();
    if (!valor) return;
    this.texto.set('');
    void this.leer(valor, 'manual');
  }

  protected async escanearConCamara(): Promise<void> {
    const s = await this.escaner.abrir('inventario');
    if (s?.accion === 'producto') this.agregar(s.sku, 'camara');
    else this.enfocar();
  }

  private async leer(codigo: string, fuente: Fuente): Promise<void> {
    const r = await this.escaner.resolver(codigo, 'inventario');
    if (r.tipo === 'producto') return this.agregar(r.producto.sku, fuente);
    this.logger.track('inventory_scan', { modo: this.pestana(), fuente, resultado: 'sin_coincidencia' });
    // "Varios" (un número de parte compartido) se resuelve eligiendo, igual que un nombre.
    const sugerencias = r.tipo === 'varios' ? r.productos : [];
    this.sinCoincidencia.set({ codigo, sugerencias });
    this.anuncio.set(this.i18n.translate('inventory.unknown'));
  }

  protected buscarPorNombre(texto: string): void {
    this.busqueda.sugerir(texto).subscribe((p) => this.sinCoincidencia.update((s) => (s ? { ...s, sugerencias: p } : s)));
  }

  protected agregar(sku: string, fuente: Fuente): void {
    if (!this.inicio) this.inicio = performance.now();
    this.sinCoincidencia.set(null);
    this.modificar((l) => sumarEscaneo(l, sku));
    this.ultimo.set(sku);
    this.resaltar(sku);
    this.logger.track('inventory_scan', { modo: this.pestana(), fuente, resultado: 'producto' });
    this.avisarCantidad(sku);
    this.enfocar();
  }

  protected fijar(sku: string, n: number): void {
    const cantidad = Number.isFinite(n) ? Math.trunc(n) : 0;
    const minimo = this.pestana() === 'conteo' ? 0 : 1;
    this.modificar((l) => l.map((x) => (x.sku === sku ? { ...x, cantidad: Math.max(minimo, cantidad) } : x)));
    this.avisarCantidad(sku);
  }

  protected quitar(sku: string): void {
    this.modificar((l) => l.filter((x) => x.sku !== sku));
    if (this.ultimo() === sku) this.ultimo.set(null);
    this.anuncio.set(this.i18n.translate('inventory.announce.removed', { nombre: this.nombre(sku) }));
    this.enfocar();
  }

  protected deshacer(): void {
    const sku = this.ultimo();
    if (!sku) return;
    const actual = this.lineas().find((l) => l.sku === sku);
    if (actual && actual.cantidad > (this.pestana() === 'conteo' ? 0 : 1)) this.modificar((l) => l.map((x) => (x.sku === sku ? { ...x, cantidad: x.cantidad - 1 } : x)));
    else this.modificar((l) => l.filter((x) => x.sku !== sku));
    this.ultimo.set(null);
    this.anuncio.set(this.i18n.translate('inventory.announce.undone'));
    this.enfocar();
  }

  protected irAlResumen(): void {
    this.error.set(null);
    this.enResumen.set(true);
  }

  protected async confirmar(): Promise<void> {
    const modo = this.pestana() as ModoInventario;
    const r = await this.api.confirmar(this.lineas(), modo, this.motivo());
    if (!r.ok) {
      this.error.set({ codigo: r.error, sku: r.sku });
      return;
    }
    this.logger.track('inventory_confirm', { modo, lineas: this.lineas().length, unidades: this.unidades(), ms: Math.round(performance.now() - this.inicio) });
    this.toast.show(modo === 'conteo' ? 'inventory.confirmedCount' : 'inventory.confirmed', 'exito', [], { productos: r.productos, unidades: r.unidades });
    this.modificar(() => []);
    this.motivo.set(null);
    this.ultimo.set(null);
    this.inicio = 0;
    this.enResumen.set(false);
    this.version.update((v) => v + 1);
    this.enfocar();
  }

  private modificar(f: (l: LineaInventario[]) => LineaInventario[]): void {
    (this.pestana() === 'conteo' ? this.conteo : this.ingreso).update(f);
  }

  private nombre(sku: string): string {
    return this.productos().find((p) => p.sku === sku)?.nombre ?? sku;
  }

  private avisarCantidad(sku: string): void {
    const n = this.lineas().find((l) => l.sku === sku)?.cantidad ?? 0;
    this.anuncio.set(this.i18n.translate('inventory.announce.added', { nombre: this.nombre(sku), n }));
  }

  private resaltar(sku: string): void {
    this.resaltado.set(sku);
    setTimeout(() => this.resaltado.update((s) => (s === sku ? '' : s)), RESALTE_MS);
  }
}

export default Inventario;
