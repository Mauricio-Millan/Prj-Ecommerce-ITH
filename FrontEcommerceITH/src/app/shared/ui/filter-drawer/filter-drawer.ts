import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Signal, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Moneda } from '../../../core/currency/currency.service';
import { Faceta, FiltrosActivos } from '../../../core/catalog/filters.logic';
import { FilterPanel } from '../filter-panel/filter-panel';
import { Icon } from '../icon/icon';

/** Lo que el listado comparte con el panel del celular: signals (así "Ver N resultados" se recalcula al marcar) y cómo cambiar los filtros. */
export interface ContextoDrawer {
  facetas: Signal<Faceta[]>;
  activos: Signal<FiltrosActivos>;
  moneda: Signal<Moneda>;
  tc: Signal<number | null>;
  total: Signal<number>;
  invitarEquipo: Signal<boolean>;
  indicarEquipo: () => void;
  cambiar: (a: FiltrosActivos) => void;
}

/**
 * Panel lateral de filtros para el celular (CA-5.10), con CDK Dialog: atrapa y devuelve el foco, cierra con ✕, Esc y clic fuera
 * (constitución P4). Su raíz lleva `data-modal="filtros-movil"`.
 */
@Component({
  selector: 'app-filter-drawer',
  imports: [TranslocoPipe, FilterPanel, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <div data-modal="filtros-movil" class="flex h-full flex-col bg-surface shadow-overlay">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="filtros-titulo" class="text-lg font-semibold">{{ 'filters.title' | transloco }}</h2>
        <button
          type="button"
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted"
          [attr.aria-label]="'filters.close' | transloco"
          (click)="ref.close()"
        ><app-icon name="cerrar" /></button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <app-filter-panel [facetas]="datos.facetas()" [activos]="datos.activos()" [moneda]="datos.moneda()" [tc]="datos.tc()" [invitarEquipo]="datos.invitarEquipo()" (cambio)="datos.cambiar($event)" (indicarEquipo)="indicarEquipo()" />
      </div>

      <div class="border-t border-border p-3">
        <button
          type="button"
          class="min-h-12 w-full rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover"
          (click)="ref.close()"
        >{{ (datos.total() === 1 ? 'filters.showResultsOne' : 'filters.showResults') | transloco: { n: datos.total() } }}</button>
      </div>
    </div>
  `,
})
export class FilterDrawer {
  protected readonly ref = inject(DialogRef);
  protected readonly datos = inject<ContextoDrawer>(DIALOG_DATA);

  /** El selector es otro diálogo: se cierra el panel primero para no apilarlos. */
  protected indicarEquipo(): void {
    this.ref.close();
    this.datos.indicarEquipo();
  }
}
