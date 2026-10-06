import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Moneda } from '../../../core/currency/currency.service';
import { Faceta, FiltrosActivos, alternarOpcion, fijarBooleano, fijarRango } from '../../../core/catalog/filters.logic';
import { Icon } from '../icon/icon';

const SIMBOLO: Record<Moneda, string> = { PEN: 'S/', USD: '$' };

/**
 * Filtros (spec 002, HU-5). Presentación pura: recibe las facetas ya calculadas y emite los filtros nuevos.
 * El control depende del tipo: lista → casillas con su cantidad; número → rango mín–máx; sí/no → una casilla.
 * El precio se escribe y se ve en la moneda activa y se emite en USD (CA-5.6).
 */
@Component({
  selector: 'app-filter-panel',
  imports: [NgTemplateOutlet, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="filtros" class="grid gap-5">
      <!-- Primer lugar: sin equipo indicado, la invitación (spec 003, CA-3.3); con equipo, la casilla "Compatible con mi equipo" es la primera faceta. -->
      @if (invitarEquipo()) {
        <button
          type="button"
          data-zone="compatibilidad"
          data-track="compatibilidad.indicar-equipo"
          class="flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-surface"
          (click)="indicarEquipo.emit()"
        >
          <app-icon name="laptop" [size]="18" />
          {{ 'compat.filterInvite' | transloco }}
        </button>
      }

      @for (f of principales(); track f.id) {
        <ng-container [ngTemplateOutlet]="plantilla" [ngTemplateOutletContext]="{ $implicit: f }" />
      }

      @if (extras().length) {
        <details class="rounded-control border border-border">
          <summary data-track="filtros.mas" class="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
            {{ 'filters.more' | transloco: { n: extras().length } }}
          </summary>
          <div class="grid gap-5 px-3 pb-3">
            @for (f of extras(); track f.id) {
              <ng-container [ngTemplateOutlet]="plantilla" [ngTemplateOutletContext]="{ $implicit: f }" />
            }
          </div>
        </details>
      }
    </div>

    <ng-template #plantilla let-f>
      <fieldset class="grid gap-1 border-0 p-0">
        <legend class="mb-1 flex w-full items-center justify-between gap-2 text-sm font-semibold">
          <span>
            {{ f.etiquetaClave | transloco }}
            @if (f.tipo === 'rango') { <span class="font-normal text-muted">({{ unidadDe(f) }})</span> }
          </span>
          @if (f.ayudaClave) {
            <button
              type="button"
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted hover:bg-surface-muted"
              [attr.aria-label]="'filters.help' | transloco"
              [attr.aria-expanded]="ayudaAbierta().has(f.id)"
              [attr.aria-controls]="'ayuda-' + f.id"
              (click)="alternarAyuda(f.id)"
            ><app-icon name="info" [size]="18" /></button>
          }
        </legend>
        @if (f.ayudaClave && ayudaAbierta().has(f.id)) {
          <p [id]="'ayuda-' + f.id" class="rounded-control bg-surface-muted p-2 text-xs text-muted">{{ f.ayudaClave | transloco }}</p>
        }

        @switch (f.tipo) {
          @case ('lista') {
            @for (o of f.opciones; track o.valor) {
              <label class="flex min-h-11 items-center gap-2 text-sm" [class.text-muted]="o.deshabilitada" [class.cursor-not-allowed]="o.deshabilitada">
                <input
                  type="checkbox"
                  class="size-5 accent-primary"
                  data-track="filtros.aplicar"
                  [checked]="o.marcada"
                  [disabled]="o.deshabilitada"
                  (change)="alternar(f, o.valor)"
                />
                <span>{{ o.etiquetaClave ? (o.etiquetaClave | transloco) : o.etiqueta }} ({{ o.cantidad }})</span>
              </label>
            }
          }
          @case ('rango') {
            <div class="grid grid-cols-2 gap-2">
              <label class="grid min-w-0 gap-1 text-xs text-muted">
                {{ 'filters.min' | transloco }}
                <input
                  #minimo
                  type="number"
                  inputmode="decimal"
                  min="0"
                  data-track="filtros.aplicar"
                  class="min-h-11 w-full min-w-0 rounded-control border border-border bg-surface px-2 text-sm text-foreground"
                  [value]="valorActual(f, 'min')"
                  [placeholder]="limite(f, 'min')"
                  (change)="aplicarRango(f, minimo.value, maximo.value)"
                />
              </label>
              <label class="grid min-w-0 gap-1 text-xs text-muted">
                {{ 'filters.max' | transloco }}
                <input
                  #maximo
                  type="number"
                  inputmode="decimal"
                  min="0"
                  data-track="filtros.aplicar"
                  class="min-h-11 w-full min-w-0 rounded-control border border-border bg-surface px-2 text-sm text-foreground"
                  [value]="valorActual(f, 'max')"
                  [placeholder]="limite(f, 'max')"
                  (change)="aplicarRango(f, minimo.value, maximo.value)"
                />
              </label>
            </div>
            @if (errorRango() === f.id) {
              <p role="alert" class="text-xs font-medium text-danger">{{ 'filters.rangeInvalid' | transloco }}</p>
            }
          }
          @case ('booleano') {
            <label class="flex min-h-11 items-center gap-2 text-sm" [class.text-muted]="f.cantidad === 0 && !f.marcada">
              <input
                type="checkbox"
                class="size-5 accent-primary"
                [attr.data-track]="f.id === 'compat' ? 'filtros.compatible' : 'filtros.aplicar'"
                [checked]="f.marcada"
                [disabled]="f.cantidad === 0 && !f.marcada"
                (change)="cambiarBooleano(f, $any($event.target).checked)"
              />
              <span>{{ f.etiquetaClave | transloco }} ({{ f.cantidad }})</span>
            </label>
          }
        }
      </fieldset>
    </ng-template>
  `,
})
export class FilterPanel {
  readonly facetas = input.required<Faceta[]>();
  readonly activos = input.required<FiltrosActivos>();
  readonly moneda = input<Moneda>('USD');
  /** Tipo de cambio vigente; `null` = el precio se maneja en USD. */
  readonly tc = input<number | null>(null);
  readonly cambio = output<FiltrosActivos>();
  /** Spec 003: sin equipo indicado y con productos que aplican, se muestra "Indica tu laptop para ver solo lo compatible". */
  readonly invitarEquipo = input(false);
  readonly indicarEquipo = output<void>();

  protected readonly ayudaAbierta = signal(new Set<string>());
  protected readonly errorRango = signal<string | null>(null);

  protected readonly principales = computed(() => this.facetas().filter((f) => f.visible));
  protected readonly extras = computed(() => this.facetas().filter((f) => !f.visible));

  /** USD → moneda que se está viendo. */
  private readonly factor = computed(() => (this.moneda() === 'PEN' && this.tc() ? this.tc()! : 1));

  protected unidadDe(f: Faceta): string {
    return f.esPrecio ? SIMBOLO[this.moneda() === 'PEN' && this.tc() ? 'PEN' : 'USD'] : (f.unidad ?? '');
  }

  protected limite(f: Faceta, borde: 'min' | 'max'): string {
    const v = f.esPrecio ? (borde === 'min' ? Math.floor(f.min * this.factor()) : Math.ceil(f.max * this.factor())) : borde === 'min' ? f.min : f.max;
    return String(v);
  }

  protected valorActual(f: Faceta, borde: 'min' | 'max'): string {
    const v = f.rangoActual?.[borde];
    if (v === undefined) return '';
    return String(f.esPrecio ? Number((v * this.factor()).toFixed(2)) : v);
  }

  protected alternarAyuda(id: string): void {
    this.ayudaAbierta.update((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  protected alternar(f: Faceta, valor: string): void {
    this.cambio.emit(alternarOpcion(this.activos(), f, valor));
  }

  protected cambiarBooleano(f: Faceta, marcado: boolean): void {
    this.cambio.emit(fijarBooleano(this.activos(), f, marcado));
  }

  /** Un mínimo mayor que el máximo no se puede aplicar (CA-5.6, H5). */
  protected aplicarRango(f: Faceta, minTxt: string, maxTxt: string): void {
    const leer = (t: string) => (t.trim() === '' ? undefined : Number(t));
    const min = leer(minTxt);
    const max = leer(maxTxt);
    if ((min !== undefined && Number.isNaN(min)) || (max !== undefined && Number.isNaN(max))) return;
    if (min !== undefined && max !== undefined && min > max) {
      this.errorRango.set(f.id);
      return;
    }
    this.errorRango.set(null);
    // El precio se escribe en la moneda activa y se guarda en USD (hasta 4 decimales, para no mover el límite al convertir de vuelta).
    const aUsd = (n: number) => (f.esPrecio ? Math.round((n / this.factor()) * 10_000) / 10_000 : n);
    const rango = { ...(min !== undefined && { min: aUsd(min) }), ...(max !== undefined && { max: aUsd(max) }) };
    this.cambio.emit(fijarRango(this.activos(), f, Object.keys(rango).length ? rango : null));
  }
}
