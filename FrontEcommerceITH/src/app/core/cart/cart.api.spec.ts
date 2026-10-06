import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast';
import { SessionApi, Usuario } from '../auth/session.api';
import { CatalogApi } from '../catalog/catalog.api';
import { Producto } from '../catalog/catalog.models';
import { localStore } from '../storage/local-store';
import { CartApi } from './cart.api';

const p = (sku: string, stock: number) => ({ sku, stock, precio_usd: 10, activo: true, nombre: sku }) as Producto;
const usuario = (id: string) => ({ id, email: `${id}@gmail.com`, nombres: id, apellidos: '', dni: null, telefono: null, rol: 'cliente' }) as Usuario;

describe('CartApi', () => {
  const sesion = signal<Usuario | null>(null);
  let catalogo: Producto[];

  const crear = () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SessionApi, useValue: { usuario: sesion } },
        { provide: CatalogApi, useValue: { todos: () => of(catalogo) } },
      ],
    });
    return TestBed.inject(CartApi);
  };

  beforeEach(() => {
    for (const k of localStore.keys().filter((x) => x.startsWith('carrito'))) localStore.remove(k);
    sesion.set(null);
    catalogo = [p('A', 10), p('B', 10), p('C', 10)];
  });
  afterEach(() => {
    for (const k of localStore.keys().filter((x) => x.startsWith('carrito'))) localStore.remove(k);
  });

  it('agregar dos veces suma en una sola línea y actualiza el contador', () => {
    const cart = crear();
    cart.agregar('A', 2, 10);
    cart.agregar('A', 1, 10);
    expect(cart.items()).toEqual([{ sku: 'A', cantidad: 3 }]);
    expect(cart.cantidadTotal()).toBe(3);
  });

  it('no supera el stock: con stock 4, agregar 3 + 3 → 4 y avisa que quedó limitado', () => {
    const cart = crear();
    cart.agregar('A', 3, 4);
    const r = cart.agregar('A', 3, 4);
    expect(cart.items()[0].cantidad).toBe(4);
    expect(r).toEqual(jasmine.objectContaining({ agregadas: 1, limitado: true }));
  });

  it('deshacerUltimo revierte la última operación y persiste en ts_carrito', () => {
    const cart = crear();
    cart.agregar('A', 2, 10);
    expect(localStore.get('carrito')).toEqual([{ sku: 'A', cantidad: 2 }]);
    cart.agregar('B', 1, 10);
    cart.deshacerUltimo();
    expect(cart.items()).toEqual([{ sku: 'A', cantidad: 2 }]);
  });

  it('agregarVarios es una sola operación: un solo deshacer quita todas las piezas', () => {
    const cart = crear();
    cart.agregar('C', 1, 10);
    const r = cart.agregarVarios([{ sku: 'A', cantidad: 1, stock: 10 }, { sku: 'B', cantidad: 2, stock: 10 }]);
    expect(r.agregadas).toBe(3);
    expect(cart.cantidadTotal()).toBe(4);
    cart.deshacerUltimo();
    expect(cart.items()).toEqual([{ sku: 'C', cantidad: 1 }]);
  });

  it('eliminar devuelve lo necesario para restaurar en el mismo lugar; vaciar deja el carrito vacío', () => {
    const cart = crear();
    cart.agregarVarios([{ sku: 'A', cantidad: 1, stock: 10 }, { sku: 'B', cantidad: 1, stock: 10 }, { sku: 'C', cantidad: 1, stock: 10 }]);
    const quitada = cart.eliminar('B')!;
    expect(cart.items().map((l) => l.sku)).toEqual(['A', 'C']);
    cart.restaurar(quitada);
    expect(cart.items().map((l) => l.sku)).toEqual(['A', 'B', 'C']);
    cart.cambiarCantidad('B', 99, 10);
    expect(cart.items()[1].cantidad).toBe(10);
    cart.vaciar();
    expect(cart.items()).toEqual([]);
    expect(localStore.get('carrito')).toEqual([]);
  });

  it('reconciliar ajusta al stock actual y guarda', () => {
    const cart = crear();
    cart.agregar('A', 5, 10);
    catalogo = [p('A', 2), p('B', 10), p('C', 10)];
    expect(cart.reconciliar()).toEqual([{ tipo: 'ajustado', sku: 'A', disponible: 2 }]);
    expect(cart.items()).toEqual([{ sku: 'A', cantidad: 2 }]);
  });

  describe('sesión (CA-5.2, 5.3)', () => {
    it('login: combina el carrito anónimo con el de la cuenta, vacía ts_carrito y avisa', () => {
      localStore.set('carrito_u1', [{ sku: 'C', cantidad: 1 }]);
      const cart = crear();
      cart.agregarVarios([{ sku: 'A', cantidad: 1, stock: 10 }, { sku: 'B', cantidad: 2, stock: 10 }]);

      sesion.set(usuario('u1'));
      TestBed.tick();

      expect(cart.items().map((l) => l.sku)).toEqual(['C', 'A', 'B']);
      expect(localStore.get('carrito_u1')).toEqual(cart.items());
      expect(localStore.get('carrito')).toBeNull();
      expect(TestBed.inject(ToastService).avisos()[0].clave).toBe('cart.merged');
    });

    it('logout: el carrito visible queda vacío y el de la cuenta queda intacto; al volver a entrar reaparece', () => {
      localStore.set('carrito_u1', [{ sku: 'C', cantidad: 2 }]);
      sesion.set(usuario('u1'));
      const cart = crear();
      expect(cart.items()).toEqual([{ sku: 'C', cantidad: 2 }]);

      sesion.set(null);
      TestBed.tick();
      expect(cart.items()).toEqual([]);
      expect(localStore.get('carrito_u1')).toEqual([{ sku: 'C', cantidad: 2 }]);

      sesion.set(usuario('u1'));
      TestBed.tick();
      expect(cart.items()).toEqual([{ sku: 'C', cantidad: 2 }]);
    });

    it('arrancar la app con la sesión ya iniciada no combina ni avisa nada', () => {
      localStore.set('carrito', [{ sku: 'A', cantidad: 1 }]);
      localStore.set('carrito_u1', [{ sku: 'C', cantidad: 1 }]);
      sesion.set(usuario('u1'));
      const cart = crear();
      TestBed.tick();
      expect(cart.items()).toEqual([{ sku: 'C', cantidad: 1 }]);
      expect(localStore.get('carrito')).toEqual([{ sku: 'A', cantidad: 1 }]);
      expect(TestBed.inject(ToastService).avisos()).toEqual([]);
    });
  });
});
