import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { Icon } from '../../../shared/ui/icon/icon';

/** CDK Dialog: atrapa y devuelve el foco, cierra con X, Esc y clic fuera (CA-1.5, constitución P4). Cada raíz se expande con `<details>` (001 CA-2.1). */
@Component({
  selector: 'app-mobile-menu',
  imports: [RouterLink, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <nav data-modal="menu-movil" class="flex h-full flex-col bg-surface shadow-overlay" [attr.aria-label]="'header.categories' | transloco">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <p class="font-semibold">{{ 'header.categories' | transloco }}</p>
        <button
          type="button"
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted"
          data-track="menu-movil.cerrar"
          [attr.aria-label]="'common.close' | transloco"
          (click)="ref.close()"
        >
          <app-icon name="cerrar" />
        </button>
      </div>
      <ul class="flex-1 overflow-y-auto p-2" data-zone="categorias">
        @for (grupo of categorias(); track grupo.categoria.slug) {
          <li>
            <details class="group">
              <summary class="flex min-h-11 cursor-pointer items-center justify-between rounded-control px-3 hover:bg-surface-muted">
                {{ grupo.categoria.clave_i18n | transloco }}
                <app-icon name="desplegar" [size]="18" />
              </summary>
              <ul class="pb-2 pl-3">
                <li>
                  <a
                    class="flex min-h-11 items-center rounded-control px-3 font-medium text-primary hover:bg-surface-muted"
                    [routerLink]="['/catalogo', grupo.categoria.slug]"
                    [attr.data-track]="'categorias.' + grupo.categoria.slug"
                    (click)="ref.close()"
                  >{{ grupo.categoria.clave_i18n | transloco }}</a>
                </li>
                @for (hija of grupo.hijas; track hija.slug) {
                  <li>
                    <a
                      class="flex min-h-11 items-center rounded-control px-3 hover:bg-surface-muted"
                      [routerLink]="['/catalogo', hija.slug]"
                      [attr.data-track]="'categorias.' + hija.slug"
                      (click)="ref.close()"
                    >{{ hija.clave_i18n | transloco }}</a>
                  </li>
                }
              </ul>
            </details>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class MobileMenu {
  protected readonly ref = inject(DialogRef);
  protected readonly categorias = toSignal(inject(CatalogApi).categoriasConHijas(), { initialValue: [] });
}
