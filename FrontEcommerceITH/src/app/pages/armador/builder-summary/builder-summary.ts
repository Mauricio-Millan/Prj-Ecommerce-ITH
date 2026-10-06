import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EstadoArmado } from '../../../core/builder/builder.models';
import { PasoId } from '../../../core/builder/pasos';
import { Moneda } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { formatear } from '../../../shared/ui/price/price';

export interface LineaResumen {
  paso: PasoId;
  nombre: string;
  /** Precio en céntimos (soles, o USD si no hay tipo de cambio). */
  centimos: number;
}

/**
 * Resumen del armado (spec 008, HU-3): piezas con su precio, total, consumo contra la fuente, estado del armado y presupuesto opcional.
 * Escritorio: columna fija a la derecha; celular: `<details>` plegado en una barra inferior (CA-3.1). El total y el estado se anuncian al cambiar.
 */
@Component({
  selector: 'app-builder-summary',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <section data-zone="resumen-pedido" class="grid min-w-0 gap-3 rounded-card border border-border bg-surface p-4 shadow-card" [attr.aria-label]="'builder.summary' | transloco">
      <h2 class="text-lg font-semibold">{{ 'builder.summary' | transloco }}</h2>

      <div>
        <label for="armador-presupuesto" class="mb-1 block text-sm font-semibold">{{ 'builder.budget' | transloco }} <span class="font-normal text-muted">({{ 'checkout.optional' | transloco }})</span></label>
        <input
          id="armador-presupuesto"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          data-track="armador.presupuesto"
          class="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm"
          [value]="presupuestoTexto()"
          [placeholder]="'builder.budgetPlaceholder' | transloco"
          (change)="alCambiarPresupuesto($any($event.target).value)"
        />
      </div>

      @if (lineas().length) {
        <ul class="grid min-w-0 gap-1 text-sm">
          @for (l of lineas(); track l.paso) {
            <li class="flex min-w-0 justify-between gap-3">
              <span class="min-w-0 flex-1 truncate"><span class="text-muted">{{ 'builder.step.' + l.paso | transloco }}:</span> {{ l.nombre }}</span>
              <span class="shrink-0 tabular-nums">{{ dinero(l.centimos) }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="text-sm text-muted">{{ 'builder.noPieces' | transloco }}</p>
      }

      <div class="grid gap-1 border-t border-border pt-3 text-sm">
        <p class="flex items-baseline justify-between text-base font-bold"><span>{{ 'cart.total' | transloco }}</span><span class="text-xl tabular-nums">{{ dinero(estado().totalCentimos) }}</span></p>
        <p class="text-xs text-muted">{{ 'currency.igvIncluded' | transloco }}</p>

        @if (estado().consumoW > 0) {
          <p class="flex items-center gap-1" [class.text-danger]="!alcanza()" [class.text-success]="alcanza() && estado().potenciaW !== null">
            {{ 'builder.consumption' | transloco: { consumo: estado().consumoW } }}
            @if (estado().potenciaW !== null) {
              · {{ 'builder.psu' | transloco: { potencia: estado().potenciaW } }}
              <app-icon [name]="alcanza() ? 'compatible' : 'advertencia'" [size]="16" />
              <span class="sr-only">{{ (alcanza() ? 'builder.psuOk' : 'builder.psuLow') | transloco }}</span>
            }
          </p>
        }

        @if (estado().restanteCentimos !== null) {
          <p class="font-medium" [class.text-danger]="estado().restanteCentimos! < 0" [class.text-success]="estado().restanteCentimos! >= 0">
            {{ (estado().restanteCentimos! < 0 ? 'builder.over' : 'builder.left') | transloco: { monto: dinero(absoluto()) } }}
          </p>
        }
      </div>

      <p role="status" aria-live="polite" class="flex items-center gap-2 rounded-control bg-surface-muted p-2 text-sm font-semibold">
        <app-icon [name]="estadoIcono()" [size]="18" />
        {{ estadoTexto() | transloco: { n: estadoN() } }}
      </p>
    </section>
  `,
})
export class BuilderSummary {
  readonly estado = input.required<EstadoArmado>();
  readonly lineas = input.required<LineaResumen[]>();
  readonly moneda = input<Moneda>('PEN');
  /** Presupuesto actual en céntimos de soles. */
  readonly presupuesto = input<number | null>(null);
  readonly presupuestoCambio = output<number | null>();

  private readonly lang = inject(LanguageService).lang;
  protected readonly dinero = (c: number) => formatear(c, this.moneda(), this.lang());
  protected readonly absoluto = computed(() => Math.abs(this.estado().restanteCentimos ?? 0));
  protected readonly alcanza = computed(() => this.estado().potenciaW === null || this.estado().consumoW <= this.estado().potenciaW!);
  protected readonly presupuestoTexto = computed(() => (this.presupuesto() === null ? '' : String(this.presupuesto()! / 100)));

  protected readonly estadoTexto = computed(() => {
    const e = this.estado();
    return e.conflictos.length + e.noDisponibles.length === 1 ? 'builder.statusConflictsOne' : e.conflictos.length || e.noDisponibles.length ? 'builder.statusConflicts' : e.faltantes.length ? 'builder.statusMissing' : 'builder.statusOk';
  });
  protected readonly estadoN = computed(() => (this.estado().conflictos.length + this.estado().noDisponibles.length) || this.estado().faltantes.length);
  protected readonly estadoIcono = computed(() => (this.estado().conflictos.length || this.estado().noDisponibles.length ? 'advertencia' : this.estado().faltantes.length ? 'info' : 'compatible'));

  /** Vacío = sin presupuesto; un monto no válido se ignora (no bloquea nada: es información, CA-3.3). */
  protected alCambiarPresupuesto(valor: string): void {
    const limpio = valor.replace(/[^\d.,]/g, '').replace(',', '.').trim();
    if (!limpio) return this.presupuestoCambio.emit(null);
    const n = Number(limpio);
    if (Number.isFinite(n) && n >= 0) this.presupuestoCambio.emit(Math.round(n * 100));
  }
}
