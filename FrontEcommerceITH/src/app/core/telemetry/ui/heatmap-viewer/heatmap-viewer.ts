import {
  ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, OnDestroy, afterRenderEffect, computed, inject, output, signal, viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { Icon } from '../../../../shared/ui/icon/icon';
import { InteractionLogger, patronDeRuta } from '../../interaction-logger';
import { Evento } from '../../telemetry.models';

type Tipo = 'click' | 'mouse_move';
const SIN_MODAL = '__ninguno';
const TODOS = '__todos';

/**
 * Visor de mapa de calor (CA-3.6–3.8), sin librerías.
 * Dos capas de canvas que no reciben clics: la de página (se desplaza con el documento) y la fija (puntos con `f = 1`).
 */
@Component({
  selector: 'app-heatmap-viewer',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-research-panel': '' },
  template: `
    <canvas #capaPagina class="pointer-events-none absolute top-0 left-0 z-[60]"></canvas>
    <canvas #capaFija class="pointer-events-none fixed inset-0 z-[60]"></canvas>

    <section class="fixed top-2 right-2 z-[61] w-72 rounded-card border border-border bg-surface p-3 text-sm shadow-overlay" [attr.aria-label]="'research.heat.title' | transloco">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ 'research.heat.title' | transloco }}</h2>
        <button type="button" class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'research.heat.close' | transloco" (click)="cerrar.emit()">
          <app-icon name="cerrar" [size]="18" />
        </button>
      </div>

      <fieldset class="mt-2 flex gap-3">
        <legend class="sr-only">{{ 'research.heat.type' | transloco }}</legend>
        <label class="flex items-center gap-1"><input type="radio" name="heat-tipo" [checked]="tipo() === 'click'" (change)="tipo.set('click')" /> {{ 'research.heat.clicks' | transloco }}</label>
        <label class="flex items-center gap-1"><input type="radio" name="heat-tipo" [checked]="tipo() === 'mouse_move'" (change)="tipo.set('mouse_move')" /> {{ 'research.heat.moves' | transloco }}</label>
      </fieldset>

      <label class="mt-2 flex items-center gap-2">
        {{ 'research.heat.modal' | transloco }}
        <select class="min-h-9 flex-1 rounded-control border border-border px-1" (change)="modal.set($any($event.target).value)">
          <option [value]="sinModal" [selected]="modal() === sinModal">{{ 'research.heat.noModal' | transloco }}</option>
          <option [value]="todos" [selected]="modal() === todos">{{ 'research.heat.allModals' | transloco }}</option>
          @for (m of modales(); track m) {
            <option [value]="m" [selected]="modal() === m">{{ m }}</option>
          }
        </select>
      </label>

      @if (sesiones().length > 1 || versiones().length > 1) {
        <div class="mt-2 grid grid-cols-2 gap-2">
          <fieldset>
            <legend class="text-xs text-muted">{{ 'research.heat.sessions' | transloco }}</legend>
            @for (s of sesiones(); track s) {
              <label class="flex items-center gap-1"><input type="checkbox" [checked]="!sesionesOcultas().has(s)" (change)="alternar(sesionesOcultas, s)" /> {{ s }}</label>
            }
          </fieldset>
          <fieldset>
            <legend class="text-xs text-muted">{{ 'research.heat.versions' | transloco }}</legend>
            @for (v of versiones(); track v) {
              <label class="flex items-center gap-1"><input type="checkbox" [checked]="!versionesOcultas().has(v)" (change)="alternar(versionesOcultas, v)" /> {{ v }}</label>
            }
          </fieldset>
        </div>
      }

      <label class="mt-2 block text-xs text-muted">
        {{ 'research.heat.import' | transloco }}
        <input type="file" multiple accept=".json,application/json" class="mt-1 block w-full text-xs" (change)="importar($any($event.target))" />
      </label>
      @for (error of erroresImportacion(); track error) {
        <p class="mt-1 text-xs text-danger" role="alert">{{ 'research.error.import' | transloco: { archivo: error } }}</p>
      }

      <div class="mt-2 flex items-center justify-between gap-2">
        <p class="text-xs text-muted">{{ 'research.heat.points' | transloco: { n: puntos().length, patron: patron() } }}</p>
        <button type="button" class="min-h-9 rounded-control border border-border px-2 text-xs hover:bg-surface-muted" (click)="actualizar()">{{ 'research.heat.redraw' | transloco }}</button>
      </div>
      <p class="mt-2 text-xs text-muted">{{ 'research.heat.help' | transloco }}</p>
    </section>
  `,
})
export class HeatmapViewer implements OnDestroy {
  readonly cerrar = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(InteractionLogger);
  private readonly router = inject(Router);
  private readonly capaPagina = viewChild.required<ElementRef<HTMLCanvasElement>>('capaPagina');
  private readonly capaFija = viewChild.required<ElementRef<HTMLCanvasElement>>('capaFija');

  protected readonly sinModal = SIN_MODAL;
  protected readonly todos = TODOS;
  protected readonly tipo = signal<Tipo>('click');
  protected readonly modal = signal(SIN_MODAL); // por defecto, sin modal (CA-3.7)
  protected readonly sesionesOcultas = signal(new Set<string>());
  protected readonly versionesOcultas = signal(new Set<string>());
  protected readonly erroresImportacion = signal<string[]>([]);

  private readonly propios = signal<Evento[]>(this.logger.eventos());
  private readonly importados = signal<Evento[]>([]); // solo en memoria (CA-3.8)
  private readonly redibujar = signal(0);

  protected readonly patron = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => patronDeRuta(this.router.routerState.snapshot.root))),
    { initialValue: patronDeRuta(this.router.routerState.snapshot.root) },
  );

  private readonly fuente = computed(() => this.propios().concat(this.importados()));
  protected readonly sesiones = computed(() => [...new Set(this.fuente().map((e) => e.s))].sort());
  protected readonly versiones = computed(() => [...new Set(this.fuente().map((e) => e.v))].sort());
  protected readonly modales = computed(() => [...new Set(this.fuente().flatMap((e) => (e.m ? [e.m] : [])))].sort());

  protected readonly puntos = computed(() => {
    const modal = this.modal();
    return this.fuente().filter(
      (e) =>
        e.e === this.tipo() &&
        e.p === this.patron() &&
        !this.sesionesOcultas().has(e.s) &&
        !this.versionesOcultas().has(e.v) &&
        (modal === TODOS || (modal === SIN_MODAL ? !e.m : e.m === modal)),
    );
  });

  private readonly alRedimensionar = () => this.redibujar.update((n) => n + 1);

  constructor() {
    this.document.defaultView?.addEventListener('resize', this.alRedimensionar);
    afterRenderEffect(() => {
      this.redibujar();
      this.dibujar(this.puntos());
    });
  }

  ngOnDestroy(): void {
    this.document.defaultView?.removeEventListener('resize', this.alRedimensionar);
  }

  protected actualizar(): void {
    this.logger.flush();
    this.propios.set(this.logger.eventos());
    this.redibujar.update((n) => n + 1);
  }

  protected alternar(conjunto: typeof this.sesionesOcultas, valor: string): void {
    conjunto.update((s) => {
      const nuevo = new Set(s);
      if (!nuevo.delete(valor)) nuevo.add(valor);
      return nuevo;
    });
  }

  protected async importar(input: HTMLInputElement): Promise<void> {
    const errores: string[] = [];
    const nuevos: Evento[] = [];
    for (const archivo of Array.from(input.files ?? [])) {
      try {
        const datos = JSON.parse(await archivo.text());
        if (!Array.isArray(datos) || datos.some((e) => typeof e?.e !== 'string' || typeof e?.p !== 'string')) throw new Error();
        nuevos.push(...datos);
      } catch {
        errores.push(archivo.name);
      }
    }
    this.importados.update((actuales) => actuales.concat(nuevos));
    this.erroresImportacion.set(errores);
    input.value = '';
  }

  private dibujar(puntos: Evento[]): void {
    const doc = this.document;
    const win = doc.defaultView!;
    // Se encoge la capa antes de medir: si no, el propio canvas impediría que el documento se achique.
    this.capaPagina().nativeElement.style.height = '0';
    const pagina = this.prepararCapa(this.capaPagina().nativeElement, doc.documentElement.scrollWidth, doc.documentElement.scrollHeight);
    const fija = this.prepararCapa(this.capaFija().nativeElement, win.innerWidth, win.innerHeight);
    const esClic = this.tipo() === 'click';
    const color = getComputedStyle(doc.documentElement).getPropertyValue(esClic ? '--color-danger' : '--color-primary').trim();
    const radio = esClic ? 28 : 18;
    const alfa = esClic ? 0.6 : 0.15;

    for (const p of puntos) {
      const pos = this.ubicar(p);
      if (!pos) continue;
      const ctx = pos.fijo ? fija : pagina;
      const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radio);
      g.addColorStop(0, color);
      g.addColorStop(1, color + '00');
      ctx.globalAlpha = alfa;
      ctx.fillStyle = g;
      ctx.fillRect(pos.x - radio, pos.y - radio, radio * 2, radio * 2);
    }
  }

  private prepararCapa(canvas: HTMLCanvasElement, ancho: number, alto: number): CanvasRenderingContext2D {
    canvas.width = ancho;
    canvas.height = alto;
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, ancho, alto);
    ctx.globalCompositeOperation = 'lighter';
    return ctx;
  }

  /**
   * Con zona: sobre la posición ACTUAL de esa zona (resiste cambios de layout entre versiones, CA-3.6).
   * Sin zona (o si la zona ya no existe): por sus coordenadas absolutas.
   */
  private ubicar(p: Evento): { x: number; y: number; fijo: boolean } | null {
    const fijo = p.f === 1;
    if (p.z && p.zx !== undefined && p.zy !== undefined) {
      const zona = this.document.querySelectorAll(`[data-zone="${CSS.escape(p.z)}"]`)[p.zi ?? 0];
      if (zona) {
        const rect = zona.getBoundingClientRect();
        const win = this.document.defaultView!;
        const x = rect.left + p.zx * rect.width;
        const y = rect.top + p.zy * rect.height;
        return fijo ? { x, y, fijo } : { x: x + win.scrollX, y: y + win.scrollY, fijo };
      }
    }
    return p.x !== undefined && p.y !== undefined ? { x: p.x, y: p.y, fijo } : null;
  }
}
