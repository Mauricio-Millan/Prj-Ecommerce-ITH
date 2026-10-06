import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

/**
 * Sobre la cuadrícula de un listado (spec 003, CA-1.1 y CA-1.6): sin equipo invita a indicarlo; con equipo lo muestra y deja
 * cambiarlo o quitarlo (H1, H3). Solo en los listados: en las fichas el nombre ya va dentro del sello (H8).
 */
@Component({
  selector: 'app-mi-equipo-tag',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="compatibilidad" class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border bg-surface-muted px-3 py-1 text-sm">
      <app-icon name="laptop" [size]="18" class="text-primary" />
      @if (equipo(); as nombre) {
        <p class="flex-1 font-semibold">{{ 'compat.tag.mine' | transloco: { equipo: nombre } }}</p>
        <button type="button" data-track="compatibilidad.cambiar-equipo" class="min-h-11 rounded-control px-2 font-semibold text-primary hover:bg-surface" (click)="cambiar.emit()">{{ 'compat.tag.change' | transloco }}</button>
        <button type="button" data-track="compatibilidad.quitar-equipo" class="min-h-11 rounded-control px-2 font-semibold text-primary hover:bg-surface" (click)="quitar.emit()">{{ 'compat.tag.remove' | transloco }}</button>
      } @else {
        <p class="flex-1">{{ 'compat.tag.ask' | transloco }}</p>
        <button type="button" data-track="compatibilidad.indicar-equipo" class="min-h-11 rounded-control px-2 font-semibold text-primary hover:bg-surface" (click)="indicar.emit()">{{ 'compat.tag.indicate' | transloco }}</button>
      }
    </div>
  `,
})
export class MiEquipoTag {
  /** Nombre del equipo, o `null` si no hay. */
  readonly equipo = input<string | null>(null);
  readonly indicar = output<void>();
  readonly cambiar = output<void>();
  readonly quitar = output<void>();
}
