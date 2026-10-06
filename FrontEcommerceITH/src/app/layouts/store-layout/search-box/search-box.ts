import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, map, of, switchMap } from 'rxjs';
import { Producto } from '../../../core/catalog/catalog.models';
import { MIN_CARACTERES_SUGERENCIA, SearchApi } from '../../../core/search/search.api';
import { Icon } from '../../../shared/ui/icon/icon';
import { Price } from '../../../shared/ui/price/price';

/**
 * Buscador con sugerencias (spec 002, HU-1). Patrón *combobox* accesible: `role="combobox"`, `aria-activedescendant`,
 * `role="listbox"`; ↑/↓ recorren, Enter abre la sugerencia marcada (o busca), Esc cierra sin borrar lo escrito (CA-1.3).
 * Se usa en el encabezado y en el hero del inicio.
 */
@Component({
  selector: 'app-search-box',
  imports: [OverlayModule, TranslocoPipe, Icon, Price],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <form role="search" data-zone="buscador" cdkOverlayOrigin #origen="cdkOverlayOrigin" class="flex w-full" (submit)="enviar($event)">
      <label [for]="inputId()" class="sr-only">{{ 'header.search.label' | transloco }}</label>
      <input
        [id]="inputId()"
        type="search"
        role="combobox"
        autocomplete="off"
        enterkeyhint="search"
        aria-autocomplete="list"
        class="w-full min-w-0 rounded-l-control border border-r-0 border-border bg-surface px-3 text-sm placeholder:text-muted"
        [class.min-h-11]="!destacado()"
        [class.min-h-14]="destacado()"
        [class.text-base]="destacado()"
        [attr.aria-expanded]="visible()"
        [attr.aria-controls]="visible() ? inputId() + '-lista' : null"
        [attr.aria-activedescendant]="activa() >= 0 && visible() ? inputId() + '-opcion-' + activa() : null"
        [placeholder]="'header.search.placeholder' | transloco"
        [value]="texto()"
        (input)="alEscribir($any($event.target).value)"
        (keydown)="alTeclear($event)"
        (blur)="abierta.set(false)"
      />
      <button
        type="submit"
        data-track="buscador.buscar"
        class="inline-flex min-w-11 items-center justify-center rounded-r-control bg-primary px-3 text-primary-foreground hover:bg-primary-hover"
        [class.min-h-11]="!destacado()"
        [class.min-h-14]="destacado()"
        [attr.aria-label]="'header.search.submit' | transloco"
      ><app-icon name="buscar" /></button>
    </form>

    <!-- Anuncia cuántas sugerencias hay (CA-1.3). -->
    <p class="sr-only" aria-live="polite">{{ visible() ? ('search.suggestionsCount' | transloco: { n: sugerencias().length }) : '' }}</p>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origen"
      [cdkConnectedOverlayOpen]="visible()"
      [cdkConnectedOverlayWidth]="origen.elementRef.nativeElement.offsetWidth"
      [cdkConnectedOverlayPositions]="posiciones"
    >
      <ul
        role="listbox"
        [id]="inputId() + '-lista'"
        [attr.aria-label]="'search.suggestionsLabel' | transloco"
        class="overflow-hidden rounded-card border border-border bg-surface shadow-overlay"
      >
        @for (p of sugerencias(); track p.sku; let i = $index) {
          <!-- mousedown no quita el foco del campo: así el clic llega antes de que se cierre la lista. -->
          <li
            role="option"
            [id]="inputId() + '-opcion-' + i"
            [attr.aria-selected]="i === activa()"
            data-track="buscador.sugerencia"
            class="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 text-sm"
            [class.bg-surface-muted]="i === activa()"
            (mousedown)="$event.preventDefault()"
            (click)="irAlProducto(p)"
          >
            <img [src]="p.imagenes[0]?.url" alt="" width="40" height="40" class="size-10 shrink-0 rounded-control bg-surface-muted object-cover" />
            <span class="line-clamp-2 flex-1">{{ p.nombre }}</span>
            <app-price [usd]="p.precio_usd" [mostrarNota]="false" class="shrink-0 text-sm" />
          </li>
        }
      </ul>
    </ng-template>
  `,
})
export class SearchBox {
  /** Cada instancia necesita su propio id (el encabezado usa `buscador`, el del inicio otro). */
  readonly inputId = input('buscador');
  /** Más grande, para el hero del inicio. */
  readonly destacado = input(false);

  private readonly router = inject(Router);
  private readonly search = inject(SearchApi);

  protected readonly posiciones: ConnectedPosition[] = [{ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 }];
  protected readonly texto = signal('');
  protected readonly abierta = signal(false);
  protected readonly activa = signal(-1);

  /** `toObservable` + `debounceTime(150)`: no se busca en cada tecla (CA-1.2). */
  protected readonly sugerencias = toSignal(
    toObservable(this.texto).pipe(
      debounceTime(150),
      map((t) => t.trim()),
      switchMap((t) => (t.length >= MIN_CARACTERES_SUGERENCIA ? this.search.sugerir(t) : of<Producto[]>([]))),
    ),
    { initialValue: [] as Producto[] },
  );
  protected readonly visible = computed(() => this.abierta() && this.sugerencias().length > 0);

  constructor() {
    // Con una lista nueva no queda marcada ninguna sugerencia.
    effect(() => {
      this.sugerencias();
      untracked(() => this.activa.set(-1));
    });
  }

  protected alEscribir(valor: string): void {
    this.texto.set(valor);
    this.abierta.set(true);
  }

  protected alTeclear(e: KeyboardEvent): void {
    const n = this.sugerencias().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!n) return;
        if (!this.abierta()) this.abierta.set(true);
        else this.activa.update((i) => (i + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (n && this.abierta()) this.activa.update((i) => (i <= 0 ? n - 1 : i - 1));
        break;
      case 'Enter':
        if (this.visible() && this.activa() >= 0) {
          e.preventDefault(); // abre la sugerencia marcada en vez de buscar el texto
          this.irAlProducto(this.sugerencias()[this.activa()]);
        }
        break;
      case 'Escape':
        e.preventDefault(); // en `type="search"` Esc borraría el texto: aquí solo cierra la lista (CA-1.3)
        this.abierta.set(false);
        this.activa.set(-1);
        break;
    }
  }

  /** Una consulta vacía o de solo espacios no hace nada (CA-1.1, H5). */
  protected enviar(e: Event): void {
    e.preventDefault();
    const q = this.texto().trim();
    if (!q) return;
    this.abierta.set(false);
    this.router.navigate(['/buscar'], { queryParams: { q } });
  }

  protected irAlProducto(p: Producto): void {
    this.abierta.set(false);
    this.router.navigate(['/producto', p.sku]);
  }
}
