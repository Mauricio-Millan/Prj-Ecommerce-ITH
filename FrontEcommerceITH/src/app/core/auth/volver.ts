import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Solo rutas internas de la tienda: empiezan con `/` y no con `//`, ni llevan esquema (CA-1.7). Cualquier otra cosa → `null`. */
export function rutaSegura(volver: string | null | undefined): string | null {
  if (!volver || !volver.startsWith('/') || volver.startsWith('//') || volver.startsWith('/\\') || volver.includes('://')) return null;
  return volver;
}

const esDeAuth = (url: string) => url === '/auth' || url.startsWith('/auth/') || url.startsWith('/auth?');

/**
 * Recuerda la última página visitada que no sea de `/auth/**`: "volver a donde estaba" cuando no hay `volver` (CA-1.6, H3).
 * Se crea al iniciar la app (`app.config.ts`) para no perder la primera navegación.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistory {
  /** `/` si todavía no se visitó nada. */
  readonly ultima = signal('/');

  constructor() {
    inject(Router).events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!esDeAuth(e.urlAfterRedirects)) this.ultima.set(e.urlAfterRedirects);
    });
  }

  /** `volver` seguro → la última página visitada → inicio. */
  destino(volver: string | null | undefined): string {
    return rutaSegura(volver) ?? this.ultima();
  }
}
