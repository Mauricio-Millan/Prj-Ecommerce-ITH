import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionApi } from './session.api';

/** Sin sesión → al login, que devuelve a esta misma ruta al terminar (spec 004; el checkout de la 006 lo reutiliza). */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(SessionApi).usuario() ? true : inject(Router).createUrlTree(['/auth/login'], { queryParams: { volver: state.url } });
