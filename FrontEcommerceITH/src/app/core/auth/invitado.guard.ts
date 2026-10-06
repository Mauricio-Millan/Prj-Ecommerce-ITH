import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionApi } from './session.api';
import { NavigationHistory } from './volver';

/** Con sesión no tiene sentido ver el login ni el registro: va directo a `volver` o al inicio (CA-1.8). */
export const invitadoGuard: CanActivateFn = (route) => {
  if (!inject(SessionApi).usuario()) return true;
  return inject(Router).parseUrl(inject(NavigationHistory).destino(route.queryParamMap.get('volver')));
};
