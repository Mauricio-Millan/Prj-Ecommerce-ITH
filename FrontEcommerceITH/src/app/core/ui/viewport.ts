import { Injectable, signal } from '@angular/core';

/**
 * Tamaño de la pantalla como signal (solo cambia al cruzar el punto de corte, no en cada resize: no es un evento de alta frecuencia).
 * Corre solo en el navegador (Fase 1: renderizado solo en el cliente).
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  /** Por debajo de `md` (768 px de Tailwind). */
  readonly movil = signal(false);

  constructor() {
    if (typeof matchMedia === 'undefined') return;
    const consulta = matchMedia('(max-width: 767px)');
    this.movil.set(consulta.matches);
    consulta.addEventListener('change', (e) => this.movil.set(e.matches));
  }
}
