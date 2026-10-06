import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export interface Paso {
  /** Clave de traducción del nombre del paso. */
  clave: string;
  /** `data-track` del paso cuando es un botón para volver (CA-7.1). */
  track?: string;
}

/**
 * Indicador de pasos "1 Envío · 2 Revisión y pago" (spec 006, CA-1.3, H1). El paso actual lleva `aria-current="step"`; los terminados son
 * botones para volver y editar sin perder lo ingresado (H3); los pendientes no son interactivos.
 */
@Component({
  selector: 'app-stepper',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex flex-wrap items-center gap-2 text-sm" [attr.aria-label]="'checkout.steps' | transloco">
      @for (p of pasos(); track p.clave; let i = $index) {
        <li class="flex items-center gap-2">
          @if (i < actual()) {
            <button type="button" class="inline-flex min-h-11 items-center gap-2 rounded-control px-2 font-medium text-primary hover:bg-surface-muted" [attr.data-track]="p.track ?? null" (click)="ir.emit(i)">
              <span class="inline-flex size-7 items-center justify-center rounded-full bg-success text-primary-foreground"><app-icon name="copiado" [size]="16" /></span>
              {{ p.clave | transloco }}
              <span class="sr-only">{{ 'checkout.stepDone' | transloco }}</span>
            </button>
          } @else {
            <span class="inline-flex min-h-11 items-center gap-2 px-2" [attr.aria-current]="i === actual() ? 'step' : null" [class.font-semibold]="i === actual()" [class.text-muted]="i > actual()">
              <span class="inline-flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold" [class.border-primary]="i === actual()" [class.bg-primary]="i === actual()" [class.text-primary-foreground]="i === actual()" [class.border-border]="i > actual()">{{ i + 1 }}</span>
              {{ p.clave | transloco }}
              @if (i === actual()) { <span class="sr-only">{{ 'checkout.stepCurrent' | transloco }}</span> }
            </span>
          }
          @if (i < pasos().length - 1) { <span class="h-px w-6 bg-border" aria-hidden="true"></span> }
        </li>
      }
    </ol>
  `,
})
export class Stepper {
  readonly pasos = input.required<Paso[]>();
  /** Índice (desde 0) del paso actual. */
  readonly actual = input.required<number>();
  readonly ir = output<number>();
}
