import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Imagen } from '../../../core/catalog/catalog.models';
import { Icon } from '../../../shared/ui/icon/icon';

const UMBRAL_DESLIZAR_PX = 40;

/**
 * Galería: miniaturas como botones, ←/→ con el teclado y deslizar en el celular (CA-5.6).
 * Cada imagen lleva su texto alternativo; con una sola imagen no se muestran controles.
 */
@Component({
  selector: 'app-gallery',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-3">
      <div
        tabindex="0"
        role="group"
        class="relative overflow-hidden rounded-card border border-border bg-surface-muted"
        [attr.aria-label]="'catalog.gallery.label' | transloco"
        (keydown)="alTeclear($event)"
        (pointerdown)="inicioX = $event.clientX"
        (pointerup)="alSoltar($event.clientX)"
      >
        <img [src]="actual().url" [alt]="actual().alt" width="600" height="600" class="aspect-square w-full touch-pan-y object-contain select-none" />
        @if (imagenes().length > 1) {
          <button type="button" class="absolute top-1/2 left-2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow-card hover:bg-surface" [attr.aria-label]="'catalog.gallery.prev' | transloco" (click)="mover(-1)">
            <app-icon name="anterior" />
          </button>
          <button type="button" class="absolute top-1/2 right-2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow-card hover:bg-surface" [attr.aria-label]="'catalog.gallery.next' | transloco" (click)="mover(1)">
            <app-icon name="siguiente" />
          </button>
        }
      </div>
      @if (imagenes().length > 1) {
        <ul class="flex gap-2">
          @for (img of imagenes(); track img.url; let i = $index) {
            <li>
              <button
                type="button"
                class="block min-h-11 min-w-11 overflow-hidden rounded-control border-2 bg-surface-muted"
                [class.border-primary]="i === indice()"
                [class.border-border]="i !== indice()"
                [attr.aria-current]="i === indice() ? 'true' : null"
                [attr.aria-label]="'catalog.gallery.thumb' | transloco: { n: i + 1 }"
                (click)="indice.set(i)"
              >
                <img [src]="img.url" alt="" width="64" height="64" class="size-16 object-cover" />
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class Gallery {
  readonly imagenes = input.required<Imagen[]>();

  protected readonly indice = signal(0);
  protected readonly actual = computed(() => this.imagenes()[this.indice()] ?? this.imagenes()[0]);
  protected inicioX = 0;

  constructor() {
    // Al pasar a otro producto se vuelve a la primera imagen.
    effect(() => {
      this.imagenes();
      untracked(() => this.indice.set(0));
    });
  }

  protected mover(delta: number): void {
    const n = this.imagenes().length;
    this.indice.update((i) => (i + delta + n) % n);
  }

  protected alTeclear(e: KeyboardEvent): void {
    if (this.imagenes().length < 2) return;
    if (e.key === 'ArrowLeft') this.mover(-1);
    else if (e.key === 'ArrowRight') this.mover(1);
    else return;
    e.preventDefault();
  }

  protected alSoltar(x: number): void {
    const dx = x - this.inicioX;
    if (this.imagenes().length > 1 && Math.abs(dx) > UMBRAL_DESLIZAR_PX) this.mover(dx < 0 ? 1 : -1);
  }
}
