import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ArmadorStore } from '../../core/builder/armador.store';
import { OMITIDO } from '../../core/builder/builder.models';
import { candidatas, disponibilidad, obligatorio, pasoDeConflicto, pieza, piezasRelacionadas, precioCentimos, reglasEntre } from '../../core/builder/builder.logic';
import { PASOS, PasoActual, PasoId, ordenDe } from '../../core/builder/pasos';
import { LanguageService } from '../../core/i18n/language.service';
import { tituloDePagina } from '../../core/i18n/page-title';
import { Viewport } from '../../core/ui/viewport';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { formatear } from '../../shared/ui/price/price';
import { BuilderReview } from './builder-review/builder-review';
import { BuilderStepper, EstadoPaso, ItemPaso } from './builder-stepper/builder-stepper';
import { BuilderSummary, LineaResumen } from './builder-summary/builder-summary';
import { ConflictBanner } from './conflict-banner/conflict-banner';
import { PartList, PiezaVista } from './part-list/part-list';
import { StepHeader } from './step-header/step-header';

/**
 * Armador de PC (spec 008): ocho pasos y un resumen, en el orden natural de armado. Solo muestra las piezas compatibles con lo ya elegido,
 * marca los conflictos al cambiar una pieza anterior (sin diálogos) y al final manda todo al carrito de una vez.
 */
@Component({
  selector: 'app-armador',
  imports: [RouterLink, TranslocoPipe, Icon, BuilderStepper, StepHeader, PartList, ConflictBanner, BuilderSummary, BuilderReview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6" [class.pb-28]="movil()">
      <h1 class="mb-4 text-2xl font-bold">{{ 'builder.title' | transloco }}</h1>

      @if (store.enviado()) {
        <!-- Ya se agregó todo: el armado quedó vacío y se ofrece armar otra PC (CA-5.4). -->
        <div class="grid max-w-xl gap-3 rounded-card border border-success bg-surface p-6">
          <p class="flex items-center gap-2 text-lg font-bold text-success"><app-icon name="compatible" [size]="24" /> {{ 'builder.sent' | transloco }}</p>
          <div class="flex flex-wrap gap-3">
            <a routerLink="/carrito" class="inline-flex min-h-12 items-center rounded-control bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'cart.view' | transloco }}</a>
            <button type="button" class="min-h-12 rounded-control border border-border px-6 font-semibold hover:bg-surface-muted" (click)="store.reiniciar()">{{ 'builder.buildAnother' | transloco }}</button>
          </div>
        </div>
      } @else {
        <div class="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)_21rem]">
          <nav class="min-w-0" [attr.aria-label]="'builder.steps' | transloco"><app-builder-stepper [pasos]="items()" (ir)="irA($event)" /></nav>

          <div class="grid min-w-0 content-start gap-4">
            <app-conflict-banner [piezas]="piezasAfectadas()" (revisar)="revisar()" />

            @if (paso(); as p) {
              <app-step-header [paso]="p" [obligatoriedad]="obligatoriedad()" [relacionadas]="nombresRelacionadas()" />
              <app-part-list
                [paso]="p"
                [piezas]="piezas()"
                [elegida]="elegida()"
                [atributos]="store.atributos()"
                [presupuesto]="store.armado().presupuestoCentimos !== null"
                [limitante]="limitante()"
                [conflicto]="conflictoDelPaso()"
                (elegir)="store.elegir(p, $event)"
                (irA)="irA($event)"
              />
              @if (!obligatoriedad().obligatorio && store.armado().piezas[p] !== omitido) {
                <button type="button" data-track="armador.omitir" class="min-h-11 justify-self-start rounded-control border border-border px-4 font-semibold hover:bg-surface-muted" (click)="store.omitir(p)">{{ 'builder.skip' | transloco }}</button>
              }
            } @else {
              <app-builder-review
                [estado]="store.estado()"
                [lineas]="lineas()"
                [moneda]="moneda()"
                [nombresFaltantes]="nombresFaltantes()"
                [pasoDeConflicto]="primerConflicto()"
                (agregar)="store.enviarAlCarrito()"
                (irA)="irA($event)"
                (reiniciar)="empezarDeNuevo()"
              />
            }

            @if (paso()) {
              <button type="button" data-track="armador.empezar-de-nuevo" class="min-h-11 justify-self-start rounded-control px-2 text-sm font-semibold text-primary underline" (click)="empezarDeNuevo()">{{ 'builder.startOver' | transloco }}</button>
            }
          </div>

          @if (!movil()) {
            <aside class="min-w-0 md:col-span-2 lg:col-span-1 lg:sticky lg:top-32 lg:self-start">
              <app-builder-summary [estado]="store.estado()" [lineas]="lineas()" [moneda]="moneda()" [presupuesto]="store.armado().presupuestoCentimos" (presupuestoCambio)="store.fijarPresupuesto($event)" />
            </aside>
          }
        </div>

        @if (movil()) {
          <!-- Celular: barra inferior plegable con el resumen (CA-3.1). -->
          <details class="fixed inset-x-0 bottom-0 z-20 max-h-[80vh] overflow-y-auto border-t border-border bg-surface shadow-overlay">
            <summary class="flex min-h-14 cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm font-semibold">
              <span>{{ 'cart.total' | transloco }}: {{ total() }}</span>
              <span [class.text-warning]="problemas() > 0">{{ problemas() > 0 ? ((problemas() === 1 ? 'builder.statusConflictsOne' : 'builder.statusConflicts') | transloco: { n: problemas() }) : ('builder.openSummary' | transloco) }}</span>
            </summary>
            <div class="p-3"><app-builder-summary [estado]="store.estado()" [lineas]="lineas()" [moneda]="moneda()" [presupuesto]="store.armado().presupuestoCentimos" (presupuestoCambio)="store.fijarPresupuesto($event)" /></div>
          </details>
        }
      }
    </div>
  `,
})
export class Armador {
  protected readonly store = inject(ArmadorStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService).lang;
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  protected readonly movil = inject(Viewport).movil;
  protected readonly omitido = OMITIDO;

  protected readonly moneda = computed(() => (this.store.tc() ? 'PEN' : 'USD'));
  /** El paso que se está viendo, o `null` en el resumen. */
  protected readonly paso = computed<PasoId | null>(() => (this.store.armado().pasoActual === 'resumen' ? null : (this.store.armado().pasoActual as PasoId)));
  protected readonly elegida = computed(() => (this.paso() ? (pieza(this.store.armado(), this.paso()!, this.store.ctx())?.sku ?? null) : null));
  protected readonly obligatoriedad = computed(() => obligatorio(this.paso() ?? 'cpu', this.store.armado(), this.store.ctx()));
  protected readonly total = computed(() => formatear(this.store.estado().totalCentimos, this.moneda(), this.lang()));
  protected readonly problemas = computed(() => this.store.estado().conflictos.length + this.store.estado().noDisponibles.length);
  protected readonly primerConflicto = computed(() => pasoDeConflicto(this.store.armado(), this.store.ctx()));

  protected readonly lineas = computed<LineaResumen[]>(() =>
    PASOS.flatMap((p) => {
      const pz = pieza(this.store.armado(), p.id, this.store.ctx());
      return pz ? [{ paso: p.id, nombre: pz.nombre, centimos: precioCentimos(pz, this.store.tc()) }] : [];
    }),
  );

  protected readonly piezas = computed<PiezaVista[]>(() => {
    const paso = this.paso();
    if (!paso) return [];
    return candidatas(paso, this.store.armado(), this.store.ctx()).map(({ producto, evaluacion }) => ({ producto, evaluacion, costo: this.store.costoDe(producto, paso) }));
  });

  protected readonly nombresRelacionadas = computed(() => (this.paso() ? piezasRelacionadas(this.paso()!, this.store.armado(), this.store.ctx()).map((p) => p.nombre) : []));

  /** El paso anterior cuya pieza limita las opciones (para "Cambiar tu procesador"): el primero relacionado que tiene pieza (CA-2.5). */
  protected readonly limitante = computed<PasoId | null>(() => {
    const paso = this.paso();
    if (!paso) return null;
    return PASOS.find((p) => ordenDe(p.id) < ordenDe(paso) && reglasEntre(paso, p.id, this.store.ctx().reglas).length > 0 && pieza(this.store.armado(), p.id, this.store.ctx()) !== null)?.id ?? null;
  });

  /** La pieza elegida en este paso, si está en conflicto o ya no está (CA-4.3, 6.3). */
  protected readonly conflictoDelPaso = computed(() => {
    const paso = this.paso();
    if (!paso) return null;
    const motivos = this.store.estado().conflictos.filter((c) => c.afectado === paso).map((c) => c.motivo);
    const noDisponible = this.store.estado().noDisponibles.includes(paso);
    const pz = pieza(this.store.armado(), paso, this.store.ctx());
    const nombre = pz?.nombre ?? this.store.armado().piezas[paso] ?? '';
    return motivos.length || noDisponible ? { nombre, motivos, noDisponible } : null;
  });

  /** Nombres de las piezas afectadas por conflictos, para el aviso de arriba (CA-4.2). */
  protected readonly piezasAfectadas = computed(() => {
    const pasos = new Set<PasoId>([...this.store.estado().conflictos.map((c) => c.afectado), ...this.store.estado().noDisponibles]);
    return PASOS.filter((p) => pasos.has(p.id)).map((p) => pieza(this.store.armado(), p.id, this.store.ctx())?.nombre ?? this.transloco.translate(`builder.step.${p.id}`));
  });

  protected readonly nombresFaltantes = computed(() => {
    this.lang();
    return this.store.estado().faltantes.map((p) => this.transloco.translate(`builder.step.${p}`)).join(', ');
  });

  /** Estado de cada paso para el indicador (CA-1.4): conflicto y no disponible pesan más que "elegido". */
  protected readonly items = computed<ItemPaso[]>(() => {
    const armado = this.store.armado();
    const ctx = this.store.ctx();
    const afectados = new Set(this.store.estado().conflictos.map((c) => c.afectado));
    const noDisp = new Set(disponibilidad(armado, ctx));
    const pasos = PASOS.map<ItemPaso>((p) => {
      const sku = armado.piezas[p.id];
      const estado: EstadoPaso = noDisp.has(p.id) ? 'no_disponible' : afectados.has(p.id) ? 'conflicto' : sku === OMITIDO ? 'omitido' : sku ? 'completo' : 'pendiente';
      return { id: p.id, clave: `builder.step.${p.id}`, estado, esActual: armado.pasoActual === p.id, subtitulo: pieza(armado, p.id, ctx)?.nombre, opcional: !obligatorio(p.id, armado, ctx).obligatorio };
    });
    const resumen: ItemPaso = { id: 'resumen', clave: 'builder.review.step', estado: this.store.estado().completo ? 'completo' : 'pendiente', esActual: armado.pasoActual === 'resumen', opcional: false };
    return [...pasos, resumen];
  });

  constructor() {
    tituloDePagina('builder.pageTitle');
    this.store.refrescar();

    // El foco va al título del paso al cambiar (accesibilidad). No se mueve al cargar la página.
    let primera = true;
    effect(() => {
      this.store.armado().pasoActual;
      if (primera) {
        primera = false;
        return;
      }
      untracked(() => afterNextRender(() => this.document.getElementById('armador-titulo')?.focus(), { injector: this.injector }));
    });
  }

  protected irA(paso: PasoActual): void {
    this.store.irA(paso);
  }

  /** "Revisar": al primer paso con conflicto (CA-4.2). */
  protected revisar(): void {
    const paso = this.primerConflicto();
    if (paso) this.store.irA(paso);
  }

  /** Empezar de nuevo pide confirmación: se pierden todas las piezas (CA-6.2, H3, H5). */
  protected empezarDeNuevo(): void {
    this.dialog
      .open<boolean>(ConfirmDialog, {
        data: { tituloClave: 'builder.startOverTitle', mensajeClave: 'builder.startOverBody', confirmarClave: 'builder.startOverConfirm' },
        ariaLabelledBy: 'confirmar-titulo',
        autoFocus: '[data-cancelar]',
      })
      .closed.subscribe((ok) => {
        if (ok) this.store.reiniciar();
      });
  }
}
