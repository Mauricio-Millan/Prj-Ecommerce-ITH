import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast';
import { SessionApi } from './session.api';

/** Sin rol admin → a la tienda con un aviso en lenguaje natural, sin errores técnicos (CA-1.4, H9). */
export const adminGuard: CanActivateFn = () => {
  if (inject(SessionApi).usuario()?.rol === 'admin') return true;
  inject(ToastService).show('access.denied', 'advertencia');
  return inject(Router).createUrlTree(['/']);
};
