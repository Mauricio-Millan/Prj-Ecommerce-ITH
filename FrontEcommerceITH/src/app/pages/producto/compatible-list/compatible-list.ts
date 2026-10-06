import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

const MAXIMO_VISIBLE = 10;

/** Lista explícita de modelos compatibles (nivel 3, modelo-datos § 3). Con más de 10 se muestran 10 y "Ver los N modelos" (CA-6.5). */
@Component({
  selector: 'app-compatible-list',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (modelos().length) {
      <div data-zone="compatibilidad">
        <ul class="grid gap-1 text-sm sm:grid-cols-2">
          @for (m of visibles(); track m) {
            <li class="rounded-control bg-surface-muted px-3 py-2">{{ m }}</li>
          }
        </ul>
        @if (modelos().length > maximo) {
          <button
            type="button"
            data-track="compatibilidad.ver-todos"
            class="mt-3 min-h-11 rounded-control border border-border px-4 text-sm font-semibold text-primary hover:bg-surface-muted"
            [attr.aria-expanded]="todos()"
            (click)="todos.set(!todos())"
          >{{ (todos() ? 'catalog.hideModels' : 'catalog.seeAllModels') | transloco: { n: modelos().length } }}</button>
        }
      </div>
    }
  `,
})
export class CompatibleList {
  /** "Lenovo IdeaPad 3 15ITL6": ya armados por la página (marca + modelo). */
  readonly modelos = input.required<string[]>();

  protected readonly maximo = MAXIMO_VISIBLE;
  protected readonly todos = signal(false);
  protected readonly visibles = computed(() => (this.todos() ? this.modelos() : this.modelos().slice(0, MAXIMO_VISIBLE)));
}
