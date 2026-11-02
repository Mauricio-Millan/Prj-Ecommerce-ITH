import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { localStore } from '../storage/local-store';

export type Tema = 'sistema' | 'claro' | 'oscuro';
export type Contraste = 'sistema' | 'normal' | 'alto';
export type Texto = 'normal' | 'grande' | 'muy-grande';
export type Espaciado = 'normal' | 'ampliado';
export type Movimiento = 'sistema' | 'reducido';

export interface PreferenciasA11y {
  tema: Tema;
  contraste: Contraste;
  texto: Texto;
  espaciado: Espaciado;
  movimiento: Movimiento;
}

export const CLAVE_PREFERENCIAS = 'pref_accesibilidad';
export const PREDETERMINADAS: PreferenciasA11y = { tema: 'sistema', contraste: 'sistema', texto: 'normal', espaciado: 'normal', movimiento: 'sistema' };

const VALORES: { [K in keyof PreferenciasA11y]: readonly PreferenciasA11y[K][] } = {
  tema: ['sistema', 'claro', 'oscuro'],
  contraste: ['sistema', 'normal', 'alto'],
  texto: ['normal', 'grande', 'muy-grande'],
  espaciado: ['normal', 'ampliado'],
  movimiento: ['sistema', 'reducido'],
};

/** Lo guardado puede venir de otra versión o estar dañado: solo se aceptan valores conocidos. */
export function sanear(guardado: unknown): PreferenciasA11y {
  const g = (guardado ?? {}) as Record<string, unknown>;
  const p = { ...PREDETERMINADAS } as Record<string, unknown>;
  for (const clave of Object.keys(VALORES) as (keyof PreferenciasA11y)[]) {
    if ((VALORES[clave] as readonly unknown[]).includes(g[clave])) p[clave] = g[clave];
  }
  return p as unknown as PreferenciasA11y;
}

/**
 * Preferencias de accesibilidad (spec 018 CA-5.6, 5.7, HU-9). Sin elección propia se respeta lo que la persona configuró en su sistema
 * (`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`); la elección propia manda y se recuerda por navegador.
 * Se aplican como atributos `data-*` en <html>; los estilos viven en `tokens.css` y `styles.css`.
 * El `<script>` de `index.html` hace lo mismo antes del primer pintado, para que no haya un destello del tema claro.
 */
@Injectable({ providedIn: 'root' })
export class PreferenciasA11yService {
  private readonly doc = inject(DOCUMENT);

  readonly prefs = signal<PreferenciasA11y>(sanear(localStore.get(CLAVE_PREFERENCIAS)));
  private readonly oscuroSistema = signal(false);
  private readonly contrasteSistema = signal(false);

  constructor() {
    const win = this.doc.defaultView;
    if (win?.matchMedia) {
      this.seguir(win.matchMedia('(prefers-color-scheme: dark)'), this.oscuroSistema);
      this.seguir(win.matchMedia('(prefers-contrast: more)'), this.contrasteSistema);
    }
    effect(() => this.aplicar(this.prefs()));
  }

  elegir<K extends keyof PreferenciasA11y>(clave: K, valor: PreferenciasA11y[K]): void {
    const nuevas = sanear({ ...this.prefs(), [clave]: valor });
    this.prefs.set(nuevas);
    localStore.set(CLAVE_PREFERENCIAS, nuevas);
  }

  restablecer(): void {
    this.prefs.set({ ...PREDETERMINADAS });
    localStore.remove(CLAVE_PREFERENCIAS);
  }

  private seguir(consulta: MediaQueryList, destino: { set(v: boolean): void }): void {
    destino.set(consulta.matches);
    consulta.addEventListener('change', (e) => destino.set(e.matches));
  }

  private aplicar(p: PreferenciasA11y): void {
    const d = this.doc.documentElement.dataset;
    d['tema'] = p.tema === 'sistema' ? (this.oscuroSistema() ? 'oscuro' : 'claro') : p.tema;
    d['contraste'] = p.contraste === 'sistema' ? (this.contrasteSistema() ? 'alto' : 'normal') : p.contraste;
    d['texto'] = p.texto;
    d['espaciado'] = p.espaciado;
    d['movimiento'] = p.movimiento === 'reducido' ? 'reducido' : 'sistema';
  }
}
