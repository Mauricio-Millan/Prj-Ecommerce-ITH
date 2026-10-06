import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { CatalogApi } from '../catalog/catalog.api';
import { CurrencyService } from '../currency/currency.service';
import { CartApi } from './cart.api';
import { detallar, resumen } from './cart.logic';

/** Carrito vacío, con agotados o sin tipo de cambio → de vuelta a `/carrito`, donde se explica el motivo (spec 006, CA-1.2). */
export const carritoPagableGuard: CanActivateFn = () => {
  const cart = inject(CartApi);
  const currency = inject(CurrencyService);
  const router = inject(Router);
  return inject(CatalogApi)
    .todos()
    .pipe(
      take(1),
      map((catalogo) => {
        const tc = currency.exchangeRate();
        return resumen(detallar(cart.items(), catalogo, tc ? Number(tc.valor) : null)).puedePagar || router.createUrlTree(['/carrito']);
      }),
    );
};

/** No se puede salir del checkout mientras se procesa el pago (CA-4.4). */
export const sinProcesarGuard: CanDeactivateFn<{ procesando(): boolean }> = (componente) => !componente.procesando();
