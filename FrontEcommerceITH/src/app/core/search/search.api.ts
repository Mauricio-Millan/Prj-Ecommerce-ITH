import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { CatalogApi } from '../catalog/catalog.api';
import { DatosIndice, Producto } from '../catalog/catalog.models';
import { palabras } from './normalize';
import { Sinonimos, interpretar } from './query';
import { Indice, construirIndice } from './search-index';
import { ResultadoBusqueda, buscar } from './search.engine';

const SIN_SINONIMOS: Sinonimos = { relleno: [], grupos: [] };
const MAX_SUGERENCIAS = 5;
const MAX_VARIANTES = 3;
export const MIN_CARACTERES_SUGERENCIA = 2;

/** Búsqueda de la Fase 1: simulada en el navegador, sin embeddings (spec 002 § 5). En la Fase 2 solo cambia el cuerpo (HttpClient). */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly http = inject(HttpClient);
  private readonly catalog = inject(CatalogApi);

  private sinonimos = SIN_SINONIMOS;
  private cache: { productos: readonly Producto[]; indice: Indice } | null = null;

  /** Carga el diccionario de sinónimos (`public/data/seed/sinonimos.json`) antes del primer render. */
  precargar(): Observable<unknown> {
    return this.http.get<Sinonimos>('data/seed/sinonimos.json').pipe(
      catchError(() => of(SIN_SINONIMOS)),
      tap((s) => (this.sinonimos = s)),
    );
  }

  /** El índice se reconstruye solo si el catálogo cambió (se compara la identidad del arreglo de productos). */
  private indice(datos: DatosIndice): Indice {
    if (this.cache?.productos !== datos.productos) this.cache = { productos: datos.productos, indice: construirIndice(datos) };
    return this.cache.indice;
  }

  buscar(texto: string, { exacto = false } = {}): Observable<ResultadoBusqueda> {
    return this.catalog.datosParaIndice().pipe(
      map((datos) => {
        const indice = this.indice(datos);
        return buscar(indice, interpretar(texto, this.sinonimos, indice.vocabulario, { exacto }));
      }),
    );
  }

  /** Hasta 5 productos mientras se escribe (desde 2 caracteres); la coincidencia exacta va primero (CA-1.2). */
  sugerir(texto: string): Observable<Producto[]> {
    if (texto.trim().length < MIN_CARACTERES_SUGERENCIA) return of([]);
    return this.buscar(texto).pipe(
      map((r) => {
        // Mientras se escribe, una lista corta y precisa vale más: si hay coincidencias completas, se sugieren solo esas.
        const completas = r.resultados.filter((x) => x.cobertura === 1);
        const base = completas.length ? completas : r.resultados;
        return [...(r.exacta ? [r.exacta] : []), ...base.map((x) => x.producto)].slice(0, MAX_SUGERENCIAS);
      }),
    );
  }

  /** Para "sin resultados": quita una palabra cada vez y devuelve hasta 3 variantes que sí encuentran algo (CA-4.1). */
  sugerenciasSinResultados(texto: string): Observable<string[]> {
    const ps = palabras(texto);
    if (ps.length < 2) return of([]);
    const variantes = ps.map((_, i) => ps.filter((__, j) => j !== i).join(' '));
    return this.catalog.datosParaIndice().pipe(
      map((datos) => {
        const indice = this.indice(datos);
        return variantes
          .filter((v) => {
            const r = buscar(indice, interpretar(v, this.sinonimos, indice.vocabulario));
            return r.exacta !== null || r.resultados.length > 0;
          })
          .slice(0, MAX_VARIANTES);
      }),
    );
  }
}
