import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { ContextoCompat } from '../compat/compat.logic';
import { localStore } from '../storage/local-store';
import { ordenar, paginar } from './catalog.logic';
import {
  Atributo, Catalogo, Categoria, Compatibilidad, DatosIndice, DetalleCategoria, Equipo, EquipoConMarca, Marca, Orden, Pagina, Producto, ProductoCompatibilidad, ReglaCompatibilidad,
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

  // — Administración (spec 009). En la Fase 2 cada método pasa a un endpoint `/api/v1/admin/...`. —

  /** Todo lo que el panel necesita, también lo oculto. Siempre relee `ts_catalogo` (el stock cambia con cada venta). */
  adminDatos(): { productos: readonly Producto[]; categorias: Categoria[]; marcas: Marca[]; atributos: Atributo[]; equipos: Equipo[]; vinculos: ProductoCompatibilidad[] } {
    const guardado = localStore.get<Catalogo>(KEY_CATALOGO);
    if (guardado && guardado.version === this.datos().version) this.catalogo = guardado;
    const c = this.datos();
    const compat = this.compat ?? VACIO_COMPAT;
    return { productos: c.productos, categorias: c.categorias, marcas: c.marcas, atributos: c.atributos, equipos: compat.equipos, vinculos: compat.producto_compatibilidad };
  }

  /** Crea o reemplaza un producto por `id`, con UNA escritura de `ts_catalogo`. */
  guardarProducto(producto: Producto): void {
    const c = this.datos();
    const existe = c.productos.some((p) => p.id === producto.id);
    const productos = existe ? c.productos.map((p) => (p.id === producto.id ? producto : p)) : [...c.productos, producto];
    this.catalogo = { ...c, productos };
    localStore.set(KEY_CATALOGO, this.catalogo);
  }

  guardarMarca(nombre: string): Marca {
    const c = this.datos();
    const marca: Marca = { id: Math.max(0, ...c.marcas.map((m) => m.id)) + 1, nombre: nombre.trim() };
    this.catalogo = { ...c, marcas: [...c.marcas, marca] };
    localStore.set(KEY_CATALOGO, this.catalogo);
    return marca;
  }

  /** Crea o actualiza un equipo. `codigos` (lo que reconocen el escaneo y "Mi equipo") se arma con el modelo y el código. */
  guardarEquipo(datos: { id?: number; marca_id: number; modelo: string; codigo_modelo: string | null; especificaciones?: Equipo['especificaciones'] }): Equipo {
    const compat = this.compat ?? VACIO_COMPAT;
    const modelo = datos.modelo.trim();
    const codigo = datos.codigo_modelo?.trim() || null;
    const base = compat.equipos.find((e) => e.id === datos.id);
    const equipo: Equipo = {
      id: base?.id ?? Math.max(0, ...compat.equipos.map((e) => e.id)) + 1,
      marca_id: datos.marca_id,
      modelo,
      codigo_modelo: codigo,
      codigos: [modelo, ...(codigo ? [codigo] : [])],
      especificaciones: datos.especificaciones ?? base?.especificaciones ?? {},
    };
    const equipos = base ? compat.equipos.map((e) => (e.id === base.id ? equipo : e)) : [...compat.equipos, equipo];
    this.compat = { ...compat, equipos };
    localStore.set(KEY_COMPAT, this.compat);
    return equipo;
  }

  /** Reemplaza los equipos compatibles de un producto (nivel 3 de compatibilidad). */
  vincularEquipos(productoId: number, equipoIds: readonly number[]): void {
    const compat = this.compat ?? VACIO_COMPAT;
    const previos = new Map(compat.producto_compatibilidad.filter((v) => v.producto_id === productoId).map((v) => [v.equipo_id, v.nota]));
    const resto = compat.producto_compatibilidad.filter((v) => v.producto_id !== productoId);
    this.compat = { ...compat, producto_compatibilidad: [...resto, ...equipoIds.map((equipo_id) => ({ producto_id: productoId, equipo_id, nota: previos.get(equipo_id) ?? null }))] };
    localStore.set(KEY_COMPAT, this.compat);
  }
}
