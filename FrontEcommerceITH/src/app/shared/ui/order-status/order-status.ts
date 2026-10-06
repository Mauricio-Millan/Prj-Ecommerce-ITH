import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EstadoPedido } from '../../../core/orders/orders.models';
import { Icon, IconName } from '../icon/icon';

const ICONO: Partial<Record<EstadoPedido, IconName>> = { pagado: 'tarjeta', enviado: 'envio', entregado: 'disponible', cancelado: 'incompatible' };
const COLOR: Partial<Record<EstadoPedido, string>> = { pagado: 'text-primary', enviado: 'text-warning', entregado: 'text-success', cancelado: 'text-danger' };

/**
 * Estado del pedido: SIEMPRE ícono + texto, nunca solo color (spec 007, CA-3.1). La variante `larga` agrega qué significa (H10).
 */
@Component({
  selector: 'app-order-status',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5 text-sm font-semibold" [class]="color()">
      <app-icon [name]="icono()" [size]="18" /> {{ 'orders.status.' + estado() | transloco }}
    </span>
    @if (variante() === 'larga') {
      <span class="block text-sm text-muted">{{ 'orders.statusHelp.' + estado() | transloco }}</span>
    }
  `,
})
export class OrderStatus {
  readonly estado = input.required<EstadoPedido>();
  readonly variante = input<'corta' | 'larga'>('corta');
  protected readonly icono = computed(() => ICONO[this.estado()] ?? 'tarjeta');
  protected readonly color = computed(() => COLOR[this.estado()] ?? '');
}
