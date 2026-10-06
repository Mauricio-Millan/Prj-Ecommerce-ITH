import { Observable, firstValueFrom, of } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { CatalogApi } from '../catalog/catalog.api';
import { Producto } from '../catalog/catalog.models';
import { CurrencyService } from '../currency/currency.service';
import { CartApi } from './cart.api';
import { carritoPagableGuard, sinProcesarGuard } from './carrito-pagable.guard';
import { LineaCarrito } from './cart.models';

const prod = (sku: string, stock: number) => ({ sku, stock, precio_usd: 10, activo: true, nombre: sku, imagenes: [] }) as unknown as Producto;

describe('guards del checkout (spec 006)', () => {
  let items: LineaCarrito[];
  let tc: { valor: string; fecha: string } | null;

  const evaluar = async () => {
    const r = TestBed.runInInjectionContext(() => carritoPagableGuard({} as never, {} as never)) as Observable<boolean | UrlTree>;
    return firstValueFrom(r);
  };

  beforeEach(() => {
    items = [{ sku: 'A', cantidad: 1 }];
    tc = { valor: '3.75', fecha: '2026-10-05' };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: CartApi, useValue: { items: () => items } },
        { provide: CatalogApi, useValue: { todos: () => of([prod('A', 5), prod('B', 0)]) } },
        { provide: CurrencyService, useValue: { exchangeRate: signal(tc) } },
      ],
    });
  });

  it('carrito pagable → deja pasar', async () => {
    expect(await evaluar()).toBeTrue();
  });

  it('carrito vacío, con agotados o sin tipo de cambio → /carrito (CA-1.2)', async () => {
    const router = TestBed.inject(Router);
    items = [];
    expect(router.serializeUrl((await evaluar()) as UrlTree)).toBe('/carrito');
    items = [{ sku: 'A', cantidad: 1 }, { sku: 'B', cantidad: 1 }];
    expect(router.serializeUrl((await evaluar()) as UrlTree)).toBe('/carrito');
  });

  it('sin tipo de cambio → /carrito', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: CartApi, useValue: { items: () => items } },
        { provide: CatalogApi, useValue: { todos: () => of([prod('A', 5)]) } },
        { provide: CurrencyService, useValue: { exchangeRate: signal(null) } },
      ],
    });
    expect(TestBed.inject(Router).serializeUrl((await evaluar()) as UrlTree)).toBe('/carrito');
  });

  it('sinProcesarGuard impide salir mientras se procesa el pago (CA-4.4)', () => {
    const salir = (procesando: boolean) => TestBed.runInInjectionContext(() => sinProcesarGuard({ procesando: () => procesando }, {} as never, {} as never, {} as never));
    expect(salir(true)).toBeFalse();
    expect(salir(false)).toBeTrue();
  });
});
