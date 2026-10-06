import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

const BASE = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control border px-3 text-sm ';
const ACTIVO = BASE + 'border-primary bg-primary text-primary-foreground';
const INACTIVO = BASE + 'border-border hover:bg-surface-muted';
const FLECHA = BASE + 'border-border hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent';

/** Números + "Anterior" / "Siguiente". El texto "Mostrando X–Y de N" lo pone la página (CA-3.6). */
@Component({
  selector: 'app-pagination',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (paginas().length > 1) {
      <nav [attr.aria-label]="'catalog.pagination.label' | transloco" class="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          [attr.data-track]="seguimiento()"
          [class]="flecha"
          [disabled]="pagina() <= 1"
          (click)="cambiar.emit(pagina() - 1)"
        >
          <app-icon name="anterior" [size]="16" /> {{ 'catalog.pagination.prev' | transloco }}
        </button>
        @for (n of paginas(); track n) {
          <button
            type="button"
            [attr.data-track]="seguimiento()"
            [class]="n === pagina() ? activo : inactivo"
            [attr.aria-current]="n === pagina() ? 'page' : null"
            [attr.aria-label]="'catalog.pagination.page' | transloco: { n }"
            (click)="n !== pagina() && cambiar.emit(n)"
          >{{ n }}</button>
        }
        <button
          type="button"
          [attr.data-track]="seguimiento()"
          [class]="flecha"
          [disabled]="pagina() >= paginas().length"
          (click)="cambiar.emit(pagina() + 1)"
        >
          {{ 'catalog.pagination.next' | transloco }} <app-icon name="siguiente" [size]="16" />
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  /** `data-track` de los botones: `resultados.pagina` en el catálogo, `pedidos.pagina` en Mis pedidos. */
  readonly seguimiento = input('resultados.pagina');
  readonly pagina = input.required<number>();
  readonly total = input.required<number>();
  readonly tamano = input.required<number>();
  readonly cambiar = output<number>();

  protected readonly activo = ACTIVO;
  protected readonly inactivo = INACTIVO;
  protected readonly flecha = FLECHA;
  protected readonly paginas = computed(() => Array.from({ length: Math.ceil(this.total() / this.tamano()) }, (_, i) => i + 1));
}
