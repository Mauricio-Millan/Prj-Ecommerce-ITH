import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

/**
 * Campo de los formularios del panel: etiqueta, control proyectado, ayuda y error (spec 009, H4, H9, H10).
 * El control lleva `[id]="campoId"` y `[attr.aria-describedby]="describedBy"`; los ids son `<id>-ayuda` y `<id>-error`.
 * `etiqueta` y `ayuda` son claves de traducción; `error` es el código (`adminProduct.error.<codigo>`).
 */
@Component({
  selector: 'app-admin-field',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-1' },
  template: `
    <label [for]="campoId()" class="text-sm font-semibold">{{ etiqueta() | transloco }}@if (requerido()) {<span aria-hidden="true"> *</span>}</label>
    <ng-content />
    @if (ayuda(); as a) {
      <p [id]="campoId() + '-ayuda'" class="text-xs text-muted">{{ a | transloco }}</p>
    }
    @if (error(); as e) {
      <p [id]="campoId() + '-error'" class="flex items-start gap-1.5 text-sm font-medium text-danger">
        <app-icon name="advertencia" [size]="16" class="mt-0.5" />
        <span>{{ 'adminProduct.error.' + e | transloco }}</span>
      </p>
    }
  `,
})
export class AdminField {
  readonly campoId = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly ayuda = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly requerido = input(false);
}

/** Valor de `aria-describedby` para un control de `app-admin-field` (spec 018, CA-4.x). */
export const describedBy = (id: string, tieneAyuda: boolean, error: string | null): string | null => [tieneAyuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || null;
