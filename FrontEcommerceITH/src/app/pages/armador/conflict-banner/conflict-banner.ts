import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Aviso de conflictos (spec 008, CA-4.1, 4.2): se ve arriba del paso actual y dice QUÉ piezas ya no calzan; "Revisar" lleva al primer paso
 * con conflicto. El cambio ya se aplicó: no hay diálogo que interrumpa (H3, H9). `role="alert"` para que se anuncie.
 */
@Component({
  selector: 'app-conflict-banner',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (piezas().length) {
      <div data-zone="armador-conflicto" role="alert" class="flex flex-wrap items-center gap-3 rounded-card border border-warning bg-surface p-3 text-sm">
        <app-icon name="advertencia" [size]="20" class="text-warning" />
        <p class="min-w-0 flex-1 font-medium">{{ (piezas().length === 1 ? 'builder.conflictBannerOne' : 'builder.conflictBanner') | transloco: { n: piezas().length, piezas: lista() } }}</p>
        <button type="button" data-track="armador.revisar-conflicto" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="revisar.emit()">{{ 'builder.reviewAction' | transloco }}</button>
      </div>
    }
  `,
})
export class ConflictBanner {
  /** Nombres de las piezas afectadas ("Placa B550M (AM4)"). */
  readonly piezas = input.required<string[]>();
  readonly revisar = output<void>();
  protected lista(): string {
    return this.piezas().join(', ');
  }
}
