import { Injectable, inject } from '@angular/core';
import { SessionApi } from '../auth/session.api';
import { leerPerfil, escribirPerfil } from '../auth/perfil';
import { MetodoPago } from '../orders/orders.models';

/** Datos editables de la cuenta (spec 006): el DNI de la boleta y el último medio de pago. En la Fase 2, la tabla `perfiles`. */
@Injectable({ providedIn: 'root' })
export class PerfilApi {
  private readonly session = inject(SessionApi);

  /** Lo guarda en la cuenta y el usuario con sesión lo ve al instante (CA-2.8, 2.9). */
  guardarDni(usuarioId: string, dni: string): void {
    if (this.session.usuario()?.id === usuarioId) this.session.actualizarPerfil({ dni });
    else escribirPerfil(usuarioId, { dni });
  }

  ultimoMetodo(usuarioId: string): MetodoPago | null {
    return leerPerfil(usuarioId).ultimoMetodo ?? null;
  }

  /** Solo el medio, nunca sus datos (CA-4.0). */
  guardarUltimoMetodo(usuarioId: string, metodo: MetodoPago): void {
    escribirPerfil(usuarioId, { ultimoMetodo: metodo });
  }
}
