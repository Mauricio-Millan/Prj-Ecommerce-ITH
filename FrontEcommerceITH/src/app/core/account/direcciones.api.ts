import { Injectable } from '@angular/core';
import { localStore } from '../storage/local-store';

export interface Direccion {
  id: string;
  ubigeo_id: string;
  direccion: string;
  referencia: string;
  destinatario: string;
  telefono: string;
  es_principal: boolean;
}

const clave = (usuarioId: string) => `direcciones_${usuarioId}`;

/** Direcciones guardadas de la cuenta (`ts_direcciones_<usuarioId>`). En la Fase 2, la tabla `direcciones`. */
@Injectable({ providedIn: 'root' })
export class DireccionesApi {
  listar(usuarioId: string): Direccion[] {
    return localStore.get<Direccion[]>(clave(usuarioId)) ?? [];
  }

  /** La primera que se guarda queda como principal (CA-2.1). */
  guardar(usuarioId: string, datos: Omit<Direccion, 'id' | 'es_principal'>): Direccion {
    const lista = this.listar(usuarioId);
    const nueva: Direccion = { ...datos, id: `d-${crypto.randomUUID()}`, es_principal: lista.length === 0 };
    localStore.set(clave(usuarioId), [...lista, nueva]);
    return nueva;
  }
}
