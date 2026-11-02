import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Si la imagen no carga, muestra su texto alternativo (spec 018, CA-1.7; WCAG 1.1.1).
 * Una imagen con el nombre al lado lleva `alt=""` (decorativa: el lector no la repite); cuando falla, ese vacío dejaría un hueco sin información,
 * así que se pone el texto (`appImgFallback`) y se aplica la clase `img-rota`, que lo hace visible dentro del mismo espacio.
 */
@Directive({
  selector: 'img[appImgFallback]',
  host: { '(error)': 'fallar()', '(load)': 'recuperar()' },
})
export class ImgFallback {
  readonly texto = input.required<string>({ alias: 'appImgFallback' });
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private altPrevio = '';

  protected fallar(): void {
    if (this.img.classList.contains('img-rota')) return;
    this.altPrevio = this.img.alt;
    this.img.alt = this.texto();
    this.img.classList.add('img-rota');
  }

  /** Si el `src` cambia (galería) y la nueva imagen sí carga, vuelve a su estado normal. */
  protected recuperar(): void {
    if (!this.img.classList.contains('img-rota')) return;
    this.img.classList.remove('img-rota');
    this.img.alt = this.altPrevio;
  }
}
