import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FilaEspecificacion } from '../../../core/catalog/catalog.logic';

/**
 * Tabla de especificaciones tal como la del fabricante (H7). `<table>` real con `<th scope="row">` (accesibilidad).
 * Se traduce el NOMBRE del atributo; el valor técnico no (DDR4, AM4, 3200 MHz) (CA-6.2).
 */
@Component({
  selector: 'app-spec-table',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table data-zone="ficha-tecnica" class="w-full border-collapse text-sm">
      <caption class="sr-only">{{ 'catalog.specs' | transloco }}</caption>
      <tbody>
        @for (f of filas(); track f.clave) {
          <tr class="border-b border-border last:border-0">
            <th scope="row" class="w-2/5 py-2 pr-4 text-left font-medium text-muted">{{ f.etiqueta | transloco }}</th>
            <td class="py-2">
              @if (f.si_no !== undefined) {
                {{ (f.si_no ? 'catalog.yes' : 'catalog.no') | transloco }}
              } @else {
                {{ f.texto }}
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class SpecTable {
  /** Ya ordenadas por `especificacionesOrdenadas` (patrón F: lo más importante primero). */
  readonly especificaciones = input.required<FilaEspecificacion[]>();

  protected readonly filas = computed(() =>
    this.especificaciones().map(({ atributo, valor }) => ({
      clave: atributo.clave,
      etiqueta: atributo.clave_i18n,
      si_no: typeof valor === 'boolean' ? valor : undefined,
      texto: Array.isArray(valor) ? valor.join(', ') : atributo.unidad ? `${valor} ${atributo.unidad}` : String(valor),
    })),
  );
}
