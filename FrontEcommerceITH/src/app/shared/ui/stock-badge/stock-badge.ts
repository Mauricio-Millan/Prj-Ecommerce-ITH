import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { estadoStock } from '../../../core/catalog/catalog.logic';
import { Icon, IconName } from '../icon/icon';

const ICONO: Record<ReturnType<typeof estadoStock>, IconName> = { disponible: 'disponible', pocas: 'advertencia', agotado: 'agotado' };

/** Estado de stock con ícono + texto: nunca solo con color (CA-4.1, accesibilidad). */
@Component({
  selector: 'app-stock-badge',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 text-sm font-medium"
      [class.text-success]="estado() === 'disponible'"
      [class.text-warning]="estado() === 'pocas'"
      [class.text-danger]="estado() === 'agotado'"
    >
      <app-icon [name]="icono()" [size]="16" />
      {{ 'stock.' + estado() | transloco: { n: stock() } }}
    </span>
  `,
})
export class StockBadge {
  readonly stock = input.required<number>();
  protected readonly estado = computed(() => estadoStock(this.stock()));
  protected readonly icono = computed(() => ICONO[this.estado()]);
}
