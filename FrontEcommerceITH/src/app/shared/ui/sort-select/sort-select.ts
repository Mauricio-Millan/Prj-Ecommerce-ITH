import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Orden } from '../../../core/catalog/catalog.models';

export const ORDENES: readonly Orden[] = ['destacados', 'precio-asc', 'precio-desc', 'nuevos'];

/** `<select>` nativo: familiar, accesible y funciona igual en el celular (H4). La 002 le agrega "Más relevantes" por `opciones`. */
@Component({
  selector: 'app-sort-select',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex items-center gap-2 text-sm">
      <span class="text-muted">{{ 'catalog.sort.label' | transloco }}</span>
      <select
        data-track="resultados.ordenar"
        class="min-h-11 rounded-control border border-border bg-surface px-2"
        (change)="cambiar.emit($any($event.target).value)"
      >
        @for (o of opciones(); track o) {
          <option [value]="o" [selected]="o === valor()">{{ 'catalog.sort.' + o.replace('-', '_') | transloco }}</option>
        }
      </select>
    </label>
  `,
})
export class SortSelect {
  readonly valor = input.required<Orden>();
  readonly opciones = input<readonly Orden[]>(ORDENES);
  readonly cambiar = output<Orden>();
}
