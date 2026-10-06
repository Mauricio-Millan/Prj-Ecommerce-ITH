import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { ContextoCompat } from '../compat/compat.logic';
import { localStore } from '../storage/local-store';
import { ordenar, paginar } from './catalog.logic';
import {
  Atributo, Catalogo, Categoria, Compatibilidad, DatosIndice, DetalleCategoria, EquipoConMarca, Marca, Orden, Pagina, Producto, ReglaCompatibilidad,
} from './catalog.models';

const KEY_CATALOGO = 'catalogo';
const KEY_COMPAT = 'compatibilidad';
const VACIO_CATALOGO: Catalogo = { version: 0, categorias: [], marcas: [], atributos: [], productos: [] };
const VACIO_COMPAT: Compatibilidad = { version: 0, equipos: [], producto_compatibilidad: [], reglas_compatibilidad: [] };

export interface OpcionesListado {
  orden: Orden;
  pagina: number;
  tamano: number;
}

/**
 * ÚNICA puerta al catálogo (constitución, Fase 1, regla 2). Las semillas se cargan por HTTP la primera vez y se copian a
 * `localStorage`. Con los datos en memoria todos los métodos emiten de forma SÍNCRONA, así la restauración del scroll al
 * volver con "Atrás" encuentra el contenido ya pintado (CA-3.7). En la Fase 2 solo cambia el cuerpo de estos métodos.
 */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private catalogo: Catalogo | null = null;
  private compat: Compatibilidad | null = null;

  /** Precarga las semillas (la usa `provideCatalogReady`, antes del primer render). */
  precargar(): Observable<unknown> {
    return forkJoin([this.cargar<Catalogo>(KEY_CATALOGO, 'catalogo', VACIO_CATALOGO), this.cargar<Compatibilidad>(KEY_COMPAT, 'compatibilidad', VACIO_COMPAT)]).pipe(
      tap(([catalogo, compat]) => {
        this.catalogo = catalogo;
        this.compat = compat;
      }),
    );
  }

  private cargar<T extends { version: number }>(clave: string, archivo: string, vacio: T): Observable<T> {
    const guardado = localStore.get<T>(clave);
    // Si la versión de la semilla cambió se vuelve a copiar (solo ocurre al desarrollar: pierde el stock modificado).
    return this.http.get<T>(`data/seed/${archivo}.json`).pipe(
      map((semilla) => {
        const usar = guardado && guardado.version === semilla.version ? guardado : semilla;
        if (usar === semilla) localStore.set(clave, semilla);
        return usar;
      }),
      // Sin semilla se conserva lo guardado; sin nada, vacío (nunca se pisa lo guardado con datos vacíos).
      catchError(() => of(guardado ?? vacio)),
    );
  }

  private datos(): Catalogo {
    return this.catalogo ?? VACIO_CATALOGO;
  }

  categoriasRaiz(): Observable<Categoria[]> {
    return of(this.datos().categorias.filter((c) => c.padre_id === null).sort((a, b) => a.orden - b.orden));
  }

  /** Raíces con sus subcategorías: lo que necesitan el encabezado y el menú móvil. */
  categoriasConHijas(): Observable<{ categoria: Categoria; hijas: Categoria[] }[]> {
    const todas = this.datos().categorias;
    return of(
      todas
        .filter((c) => c.padre_id === null)
        .sort((a, b) => a.orden - b.orden)
        .map((categoria) => ({ categoria, hijas: todas.filter((h) => h.padre_id === categoria.id).sort((a, b) => a.orden - b.orden) })),
    );
  }

  categoria(slug: string): Observable<DetalleCategoria | null> {
    return of(this.detalle((c) => c.slug === slug));
  }

  categoriaDe(id: number): Observable<DetalleCategoria | null> {
    return of(this.detalle((c) => c.id === id));
  }

  private detalle(coincide: (c: Categoria) => boolean): DetalleCategoria | null {
    const todas = this.datos().categorias;
    const categoria = todas.find(coincide);
    if (!categoria) return null;
    return {
      categoria,
      padre: todas.find((c) => c.id === categoria.padre_id) ?? null,
      hijas: todas.filter((c) => c.padre_id === categoria.id).sort((a, b) => a.orden - b.orden),
    };
  }

  private activos(): Producto[] {
    return this.datos().productos.filter((p) => p.activo);
  }

  /** Los productos de la categoría y de sus subcategorías (solo activos). */
  productosDe(categoriaId: number, { orden, pagina, tamano }: OpcionesListado): Observable<Pagina<Producto>> {
    const ids = new Set([categoriaId, ...this.datos().categorias.filter((c) => c.padre_id === categoriaId).map((c) => c.id)]);
    return of(paginar(ordenar(this.activos().filter((p) => ids.has(p.categoria_id)), orden), pagina, tamano));
  }

  /** Todos los productos de la categoría y sus subcategorías, sin ordenar ni paginar (los filtros y el orden los aplica el listado, spec 002). */
  listadoDe(categoriaId: number): Observable<Producto[]> {
    const ids = new Set([categoriaId, ...this.datos().categorias.filter((c) => c.padre_id === categoriaId).map((c) => c.id)]);
    return of(this.activos().filter((p) => ids.has(p.categoria_id)));
  }

  categorias(): Observable<Categoria[]> {
    return of(this.datos().categorias);
  }

  marcas(): Observable<Marca[]> {
    return of(this.datos().marcas);
  }

  atributos(): Observable<Atributo[]> {
    return of(this.datos().atributos);
  }

  /**
   * Todo lo que necesita el motor de búsqueda (spec 002). El arreglo `productos` conserva su identidad mientras no se recargue el
   * catálogo, así el índice se reconstruye solo cuando los datos cambian de verdad.
   */
  datosParaIndice(): Observable<DatosIndice> {
    const catalogo = this.datos();
    const compat = this.compat ?? VACIO_COMPAT;
    return of({
      productos: catalogo.productos,
      categorias: catalogo.categorias,
      marcas: catalogo.marcas,
      equipos: compat.equipos,
      producto_compatibilidad: compat.producto_compatibilidad,
    });
  }

  /** Reglas de compatibilidad entre piezas de PC (spec 008): datos, no código. */
  reglas(): Observable<ReglaCompatibilidad[]> {
    return of((this.compat ?? VACIO_COMPAT).reglas_compatibilidad);
  }

  /** Lo que necesita la compatibilidad con "Mi equipo" (spec 003). Cambia de identidad solo si se recarga el catálogo. */
  contextoCompat(): Observable<ContextoCompat> {
    const catalogo = this.datos();
    const compat = this.compat ?? VACIO_COMPAT;
    return of({
      categorias: catalogo.categorias,
      atributos: catalogo.atributos,
      marcas: catalogo.marcas,
      equipos: compat.equipos,
      compatibilidades: compat.producto_compatibilidad,
    });
  }

  /**
   * Todos los productos, también los inactivos (el carrito necesita saber que uno "ya no está disponible", spec 005).
   * Emite de forma síncrona, como el resto de la clase.
   */
  todos(): Observable<readonly Producto[]> {
    // El stock puede cambiar mientras el cliente compra (otro cliente, otra pestaña, el moderador): `ts_catalogo` es la fuente de verdad (spec 006, CA-5.4).
    const guardado = localStore.get<Catalogo>(KEY_CATALOGO);
    if (guardado && guardado.version === this.datos().version) this.catalogo = guardado;
    return of(this.datos().productos);
  }

  /**
   * Descuenta stock con UNA sola escritura de `ts_catalogo` (spec 006, CA-5.1). Es la única forma de modificar el catálogo fuera de la
   * semilla. `stockPorSku` trae el stock NUEVO de cada producto que cambió.
   */
  reemplazarStock(stockPorSku: Record<string, number>): void {
    const catalogo = this.datos();
    const nuevo: Catalogo = { ...catalogo, productos: catalogo.productos.map((p) => (p.sku in stockPorSku ? { ...p, stock: stockPorSku[p.sku] } : p)) };
    this.catalogo = nuevo;
    localStore.set(KEY_CATALOGO, nuevo);
  }

  /** `null` si no existe o está inactivo (CA-7.3). */
  producto(sku: string): Observable<Producto | null> {
    return of(this.activos().find((p) => p.sku === sku) ?? null);
  }

  destacados(n: number): Observable<Producto[]> {
    return of(ordenar(this.activos().filter((p) => p.destacado), 'destacados').slice(0, n));
  }

  /** De la misma subcategoría; los disponibles primero. */
  relacionados(producto: Producto, n: number): Observable<Producto[]> {
    return of(ordenar(this.activos().filter((p) => p.categoria_id === producto.categoria_id && p.id !== producto.id), 'destacados').slice(0, n));
  }

  atributosDe(categoriaId: number): Observable<Atributo[]> {
    return of(this.datos().atributos.filter((a) => a.categoria_id === categoriaId).sort((a, b) => a.orden - b.orden));
  }

  marca(id: number): Observable<Marca | null> {
    return of(this.datos().marcas.find((m) => m.id === id) ?? null);
  }

  /** Nivel 3 de compatibilidad (modelo-datos § 3): la lista explícita de modelos del producto. */
  equiposCompatibles(productoId: number): Observable<EquipoConMarca[]> {
    const compat = this.compat ?? VACIO_COMPAT;
    const marcas = this.datos().marcas;
    return of(
      compat.producto_compatibilidad
        .filter((pc) => pc.producto_id === productoId)
        .flatMap((pc) => compat.equipos.filter((e) => e.id === pc.equipo_id))
        .map((e) => ({ ...e, marca: marcas.find((m) => m.id === e.marca_id)?.nombre ?? '' })),
    );
  }
}
