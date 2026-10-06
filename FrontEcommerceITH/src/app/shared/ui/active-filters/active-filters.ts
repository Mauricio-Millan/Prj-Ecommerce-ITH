import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export interface ChipFiltro {
  /** Faceta y valor: con ellos el listado sabe cuál quitar. */
  id: string;
  valor: string;
  /** Texto literal (marcas, valores técnicos, rangos ya formateados). */
  texto?: string;
  /** Clave de traducción (subcategorías, "solo disponibles"). */
  clave?: string;
  /** Nombre del atributo para los rangos: "Capacidad: 16–32 GB". */
  prefijoClave?: string;
}

/** Los filtros aplicados como etiquetas con ✕ y "Limpiar todo" (CA-5.7, H1, H3). */
@Component({
  selector: 'app-active-filters',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chips().length) {
      <div class="flex flex-wrap items-center gap-2" role="group" [attr.aria-label]="'filters.applied' | transloco">
        @for (chip of chips(); track chip.id + chip.valor) {
          <span class="inline-flex items-center gap-1 rounded-full border border-primary bg-surface-muted py-0.5 pr-0.5 pl-3 text-sm">
            @if (chip.prefijoClave) { {{ chip.prefijoClave | transloco }}: }
            {{ chip.clave ? (chip.clave | transloco) : chip.texto }}
            <button
              type="button"
              data-track="filtros.quitar"
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-surface"
              [attr.aria-label]="'filters.removeNamed' | transloco: { nombre: (chip.clave ? (chip.clave | transloco) : chip.texto) }"
              (click)="quitar.emit(chip)"
            ><app-icon name="cerrar" [size]="16" /></button>
          </span>
        }
        <button
          type="button"
          data-track="filtros.limpiar"
          class="min-h-11 rounded-control px-3 text-sm font-semibold text-primary hover:bg-surface-muted"
          (click)="limpiar.emit()"
        >{{ 'filters.clearAll' | transloco }}</button>
      </div>
    }
  `,
})
export class ActiveFilters {
  readonly chips = input.required<ChipFiltro[]>();
  readonly quitar = output<ChipFiltro>();
  readonly limpiar = output<void>();
}
