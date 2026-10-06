import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PasoActual } from '../../../core/builder/pasos';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

export type EstadoPaso = 'pendiente' | 'completo' | 'omitido' | 'conflicto' | 'no_disponible';

export interface ItemPaso {
  id: PasoActual;
  /** Clave de traducción del nombre. */
  clave: string;
  estado: EstadoPaso;
  /** El paso que se está viendo: lleva aria-current="step" aunque además tenga un conflicto. */
  esActual: boolean;
  /** La pieza elegida. */
  subtitulo?: string;
  opcional: boolean;
}

const ICONO: Partial<Record<EstadoPaso, IconName>> = { completo: 'copiado', conflicto: 'advertencia', no_disponible: 'agotado' };
const COLOR: Record<EstadoPaso, string> = { pendiente: 'text-muted', completo: 'text-success', omitido: 'text-muted', conflicto: 'text-warning', no_disponible: 'text-danger' };

/**
 * Indicador de pasos del armador (spec 008, CA-1.4): TODOS los pasos son botones (se puede ir a cualquiera). Cada uno dice su estado con
 * ícono + texto (nunca solo color) y muestra la pieza elegida. Vertical en escritorio y horizontal con desplazamiento en el celular.
 * (La 006 usa su propio `app-stepper` lineal.)
 */
@Component({
  selector: 'app-builder-stepper',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible" [attr.aria-label]="'builder.steps' | transloco">
      @for (p of pasos(); track p.id; let i = $index) {
        <li class="shrink-0">
          <button
            type="button"
            class="flex min-h-11 w-full items-start gap-2 rounded-control border px-3 py-2 text-left text-sm hover:bg-surface-muted"
            [class.border-primary]="p.esActual"
            [class.bg-surface-muted]="p.esActual"
            [class.border-border]="!p.esActual"
            [attr.aria-current]="p.esActual ? 'step' : null"
            [attr.data-track]="'armador.paso-' + (i + 1)"
            (click)="ir.emit(p.id)"
          >
            <span class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-xs font-bold" [class]="color(p.estado)">
              @if (icono(p.estado); as ic) { <app-icon [name]="ic" [size]="18" /> } @else { {{ i + 1 }} }
            </span>
            <span class="grid min-w-0">
              <span class="font-semibold">{{ p.clave | transloco }} @if (p.opcional) { <span class="font-normal text-muted">({{ 'builder.optional' | transloco }})</span> }</span>
              <span class="text-xs" [class]="color(p.estado)">{{ 'builder.state.' + p.estado | transloco }}</span>
              @if (p.subtitulo) { <span class="truncate text-xs text-muted">{{ p.subtitulo }}</span> }
            </span>
          </button>
        </li>
      }
    </ol>
  `,
})
export class BuilderStepper {
  readonly pasos = input.required<ItemPaso[]>();
  readonly ir = output<PasoActual>();
  protected readonly icono = (e: EstadoPaso) => ICONO[e] ?? null;
  protected readonly color = (e: EstadoPaso) => COLOR[e];
}
