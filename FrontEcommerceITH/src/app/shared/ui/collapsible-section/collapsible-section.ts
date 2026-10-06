import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Sección con título. En el celular puede plegarse (`<details>` nativo, accesible sin JS); en escritorio el contenido
 * va siempre visible, sin pestañas ni acordeones (CA-6.6).
 */
@Component({
  selector: 'app-collapsible-section',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #contenido><ng-content /></ng-template>
    @if (plegable()) {
      <details class="rounded-card border border-border bg-surface" [open]="abierta()">
        <summary class="min-h-11 cursor-pointer px-4 py-3 text-lg font-semibold">{{ titulo() }}</summary>
        <div class="px-4 pb-4"><ng-container [ngTemplateOutlet]="contenido" /></div>
      </details>
    } @else {
      <section>
        <h2 class="mb-3 text-xl font-semibold">{{ titulo() }}</h2>
        <ng-container [ngTemplateOutlet]="contenido" />
      </section>
    }
  `,
})
export class CollapsibleSection {
  readonly titulo = input.required<string>();
  readonly plegable = input(false);
  readonly abierta = input(false);
}
