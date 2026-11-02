import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PreferenciasA11y, PreferenciasA11yService } from '../../../core/a11y/preferencias.service';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { Icon } from '../icon/icon';

interface Grupo {
  clave: keyof PreferenciasA11y;
  opciones: readonly string[];
}

/**
 * Preferencias de accesibilidad (spec 018 CA-5.6): tema, contraste, tamaño y espaciado del texto y movimiento. Se aplican al instante.
 * Cada grupo es un conjunto de botones de radio (se manejan con flechas y se anuncian como grupo). Raíz con `data-modal="accesibilidad"`.
 * Se abre con `ariaLabelledBy: 'a11y-titulo'`.
 */
@Component({
  selector: 'app-a11y-panel',
  imports: [TranslocoPipe, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-modal="accesibilidad" data-zone="accesibilidad" class="flex max-h-[90vh] w-[min(32rem,94vw)] flex-col rounded-card bg-surface shadow-overlay">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="a11y-titulo" class="text-lg font-semibold">{{ 'a11y.title' | transloco }}</h2>
        <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'common.close' | transloco" (click)="ref.close()">
          <app-icon name="cerrar" />
        </button>
      </div>

      <div class="grid gap-4 overflow-y-auto p-4">
        <p class="text-sm text-muted">{{ 'a11y.intro' | transloco }}</p>
        @for (g of grupos; track g.clave) {
          <fieldset class="grid gap-2">
            <legend class="mb-1 text-sm font-semibold">{{ 'a11y.' + g.clave + '.label' | transloco }}</legend>
            <div class="flex flex-wrap gap-2">
              @for (o of g.opciones; track o) {
                <label class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border-control px-3 text-sm has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                  <input
                    type="radio"
                    class="size-4 accent-primary"
                    [name]="'a11y-' + g.clave"
                    [value]="o"
                    [checked]="s.prefs()[g.clave] === o"
                    [attr.data-track]="'accesibilidad.' + g.clave"
                    (change)="elegir(g.clave, o)"
                  />
                  {{ 'a11y.' + g.clave + '.' + o | transloco }}
                </label>
              }
            </div>
          </fieldset>
        }
      </div>

      <div class="flex flex-wrap justify-between gap-3 border-t border-border p-3">
        <button type="button" data-track="accesibilidad.restablecer" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="restablecer()">{{ 'a11y.reset' | transloco }}</button>
        <a routerLink="/accesibilidad" class="inline-flex min-h-11 items-center px-2 font-semibold text-primary underline underline-offset-4" (click)="ref.close()">{{ 'a11y.statement' | transloco }}</a>
      </div>
    </div>
  `,
})
export class A11yPanel {
  protected readonly ref = inject(DialogRef);
  protected readonly s = inject(PreferenciasA11yService);
  private readonly logger = inject(InteractionLogger);

  protected readonly grupos: readonly Grupo[] = [
    { clave: 'tema', opciones: ['sistema', 'claro', 'oscuro'] },
    { clave: 'contraste', opciones: ['sistema', 'normal', 'alto'] },
    { clave: 'texto', opciones: ['normal', 'grande', 'muy-grande'] },
    { clave: 'espaciado', opciones: ['normal', 'ampliado'] },
    { clave: 'movimiento', opciones: ['sistema', 'reducido'] },
  ];

  protected elegir(clave: keyof PreferenciasA11y, valor: string): void {
    this.s.elegir(clave, valor as never);
    this.logger.track('a11y_pref_set', { preferencia: clave, valor });
  }

  protected restablecer(): void {
    this.s.restablecer();
    this.logger.track('a11y_pref_set', { preferencia: 'todas', valor: 'restablecer' });
  }
}
