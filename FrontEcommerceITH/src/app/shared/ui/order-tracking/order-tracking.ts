import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../core/i18n/language.service';
import { PasoSeguimiento } from '../../../core/orders/orders.logic';
import { Icon } from '../icon/icon';

/**
 * Seguimiento como el de un envío: Pagado → Enviado → Entregado, con la fecha de cada paso alcanzado y los siguientes "Pendiente"
 * (spec 007, CA-3.2, 3.3). El último paso alcanzado lleva `aria-current="step"`. Si la tienda canceló, termina en "Cancelado".
 */
@Component({
  selector: 'app-order-tracking',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="grid gap-3 sm:grid-flow-col sm:auto-cols-fr" [attr.aria-label]="'orders.tracking' | transloco">
      @for (p of pasos(); track p.estado) {
        <li class="flex items-start gap-3 sm:flex-col sm:gap-1" [attr.aria-current]="p.actual ? 'step' : null">
          <span
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2"
            [class.border-success]="p.fecha && p.estado !== 'cancelado'"
            [class.bg-success]="p.fecha && p.estado !== 'cancelado'"
            [class.text-primary-foreground]="p.fecha"
            [class.border-danger]="p.estado === 'cancelado'"
            [class.bg-danger]="p.estado === 'cancelado'"
            [class.border-border]="!p.fecha"
          >
            @if (p.fecha) { <app-icon [name]="p.estado === 'cancelado' ? 'cerrar' : 'copiado'" [size]="16" /> }
          </span>
          <span class="text-sm">
            <span class="block font-semibold">{{ 'orders.status.' + p.estado | transloco }}</span>
            <span class="block text-muted">{{ p.fecha ? fecha(p.fecha) : ('orders.pending' | transloco) }}</span>
          </span>
        </li>
      }
    </ol>
  `,
})
export class OrderTracking {
  readonly pasos = input.required<PasoSeguimiento[]>();
  private readonly lang = inject(LanguageService).lang;

  protected fecha(iso: string): string {
    return new Intl.DateTimeFormat(this.lang() === 'qu-PE' ? 'es-PE' : this.lang(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }
}
