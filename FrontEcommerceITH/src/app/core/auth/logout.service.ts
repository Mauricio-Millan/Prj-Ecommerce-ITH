import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast';
import { SessionApi } from './session.api';

/** ¿La ruta activa (o alguna de sus padres) lleva `data: { privada: true }`? Checkout, pedidos, cuenta y administración. */
export function esRutaPrivada(raiz: ActivatedRouteSnapshot): boolean {
  for (let r: ActivatedRouteSnapshot | null = raiz; r; r = r.firstChild) if (r.data['privada']) return true;
  return false;
}

/** Cerrar sesión (CA-4.2): avisa y, si la página necesita sesión, vuelve al inicio. Lo usan el encabezado y el panel de administración. */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly session = inject(SessionApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  cerrar(): void {
    const privada = esRutaPrivada(this.router.routerState.snapshot.root);
    this.session.cerrarSesion();
    this.toast.show('auth.loggedOut', 'info');
    if (privada) this.router.navigateByUrl('/');
  }
}
