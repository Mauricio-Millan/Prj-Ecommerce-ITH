import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

/** Nunca una página en blanco: ícono + mensaje + salidas (los enlaces se proyectan) (H9). */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl px-4 py-12 text-center">
      <span class="mx-auto mb-4 inline-flex rounded-full bg-surface-muted p-4 text-muted"><app-icon [name]="icono()" [size]="32" /></span>
      <h2 class="text-xl font-bold md:text-2xl">{{ titulo() }}</h2>
      @if (mensaje()) {
        <p class="mt-2 text-muted">{{ mensaje() }}</p>
      }
      <div class="mt-6 flex flex-wrap justify-center gap-2"><ng-content /></div>
    </section>
  `,
})
export class EmptyState {
  readonly icono = input<IconName>('vacio');
  readonly titulo = input.required<string>();
  readonly mensaje = input<string>();
}
