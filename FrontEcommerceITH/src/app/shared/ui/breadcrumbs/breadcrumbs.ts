import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export interface Miga {
  /** Clave de traducción (se traduce con el pipe: cambia de idioma sin recargar). */
  clave?: string;
  /** Texto literal, para contenido del catálogo que no se traduce (nombre de un producto). */
  texto?: string;
  /** Sin ruta = nivel actual. */
  ruta?: unknown[];
}

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="'catalog.breadcrumbs' | transloco">
      <ol class="flex flex-wrap items-center gap-x-1 text-sm text-muted">
        @for (miga of items(); track $index; let ultima = $last) {
          <li class="flex items-center gap-1">
            @if (!ultima && miga.ruta) {
              <a [routerLink]="miga.ruta" class="inline-flex min-h-8 items-center underline-offset-2 hover:underline">{{ miga.clave ? (miga.clave | transloco) : miga.texto }}</a>
              <app-icon name="siguiente" [size]="14" />
            } @else {
              <span aria-current="page" class="font-medium text-foreground">{{ miga.clave ? (miga.clave | transloco) : miga.texto }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Breadcrumbs {
  readonly items = input.required<Miga[]>();
}
