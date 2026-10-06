import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToastService } from '../../shared/ui/toast/toast';
import { SessionApi } from '../auth/session.api';
import { CatalogApi } from '../catalog/catalog.api';
import { Producto } from '../catalog/catalog.models';
import { localStore } from '../storage/local-store';
import { combinar, fijarCantidad, quitar, reconciliar, restaurar, sumar } from './cart.logic';
import { AvisoCarrito, LineaCarrito, Quitada, ResultadoSumar } from './cart.models';

/** `carrito` sin sesión; `carrito_<usuarioId>` con sesión (simula las tablas `carritos` + `carrito_items`, spec 005 § 2.1). */
const claveDe = (usuarioId: string | null) => (usuarioId ? `carrito_${usuarioId}` : 'carrito');

/**
 * El carrito (spec 005). Guarda solo sku y cantidad. Un `effect` sobre la sesión cambia de clave: al iniciar sesión combina el carrito
 * anónimo con el de la cuenta; al cerrarla, el visible queda vacío y el de la cuenta se conserva (CA-5.2, 5.3). La autenticación
 * (spec 004) no conoce al carrito.
 */
@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly session = inject(SessionApi);
  private readonly catalog = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  /** Se inicializa con el usuario actual: al arrancar la app con la sesión ya iniciada no se combina nada. */
  private usuarioId = this.session.usuario()?.id ?? null;
  private clave = claveDe(this.usuarioId);
  private readonly _items = signal<LineaCarrito[]>(localStore.get<LineaCarrito[]>(this.clave) ?? []);
  readonly items = this._items.asReadonly();
  /** Unidades totales: lo que muestra el contador del encabezado (H1, CA-1.5). */
  readonly cantidadTotal = computed(() => this._items().reduce((suma, l) => suma + l.cantidad, 0));

  /** Estado anterior a la última operación de agregar, para "Deshacer" (también deshace un armado completo, CA-6.1). */
  private previo: LineaCarrito[] | null = null;

  constructor() {
    effect(() => {
      const id = this.session.usuario()?.id ?? null;
      untracked(() => this.cambiarDeCuenta(id));
    });
  }

  private cambiarDeCuenta(id: string | null): void {
    if (id === this.usuarioId) return;
    const anterior = this.usuarioId;
    this.usuarioId = id;
    this.clave = claveDe(id);
    this.previo = null;

    if (anterior === null && id !== null) {
      // Login: el carrito de antes de entrar se suma al de la cuenta y deja de existir como anónimo (CA-5.2).
      const anonimo = localStore.get<LineaCarrito[]>('carrito') ?? [];
      const { items, agregadas } = combinar(anonimo, localStore.get<LineaCarrito[]>(this.clave) ?? [], this.catalogo());
      this.guardar(items);
      localStore.remove('carrito');
      if (agregadas > 0) this.toast.show('cart.merged', 'info');
    } else {
      // Logout (o cambio directo de cuenta): se ve el carrito de la clave nueva; el de la cuenta anterior queda guardado (CA-5.3).
      this._items.set(localStore.get<LineaCarrito[]>(this.clave) ?? []);
    }
  }

  /** El catálogo emite de forma síncrona (ver `CatalogApi`), así que se puede leer aquí sin esperar. */
  private catalogo(): readonly Producto[] {
    let lista: readonly Producto[] = [];
    this.catalog.todos().subscribe((p) => (lista = p)).unsubscribe();
    return lista;
  }

  /** `stock` lo da quien llama (ya tiene el producto). */
  agregar(sku: string, cantidad: number, stock: number): ResultadoSumar {
    const resultado = sumar(this._items(), sku, cantidad, stock);
    if (resultado.agregadas > 0) {
      this.previo = this._items();
      this.guardar(resultado.items);
    }
    return resultado;
  }

  /** Varias piezas en UNA operación y UN solo deshacer (el armador, spec 008, CA-6.1). */
  agregarVarios(lineas: readonly { sku: string; cantidad: number; stock: number }[]): { agregadas: number; limitado: boolean } {
    let items = this._items();
    let agregadas = 0;
    let limitado = false;
    for (const l of lineas) {
      const r = sumar(items, l.sku, l.cantidad, l.stock);
      items = r.items;
      agregadas += r.agregadas;
      limitado ||= r.limitado;
    }
    if (agregadas > 0) {
      this.previo = this._items();
      this.guardar(items);
    }
    return { agregadas, limitado };
  }

  deshacerUltimo(): void {
    if (!this.previo) return;
    this.guardar(this.previo);
    this.previo = null;
  }

  cambiarCantidad(sku: string, cantidad: number, stock: number): void {
    this.guardar(fijarCantidad(this._items(), sku, cantidad, stock));
  }

  /** Sin confirmación: el aviso trae "Deshacer" (CA-3.1). Devuelve lo necesario para restaurar. */
  eliminar(sku: string): Quitada | null {
    const { items, quitada } = quitar(this._items(), sku);
    if (quitada) this.guardar(items);
    return quitada;
  }

  restaurar(quitada: Quitada): void {
    this.guardar(restaurar(this._items(), quitada));
  }

  vaciar(): void {
    this.previo = null;
    this.guardar([]);
  }

  /** Pone el carrito al día con el catálogo actual (stock, productos inactivos) y devuelve qué cambió (HU-4). */
  reconciliar(): AvisoCarrito[] {
    const { items, avisos } = reconciliar(this._items(), this.catalogo());
    if (avisos.length) this.guardar(items);
    return avisos;
  }

  private guardar(items: LineaCarrito[]): void {
    this._items.set(items);
    localStore.set(this.clave, items);
  }
}
