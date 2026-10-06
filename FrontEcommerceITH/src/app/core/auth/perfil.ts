import { localStore } from '../storage/local-store';

/** Lo que el cliente edita de su cuenta en la Fase 1: la semilla de usuarios es de solo lectura, así que esto se superpone (spec 006 § 1.1). */
export interface Perfil {
  dni?: string;
  telefono?: string;
  /** Solo el medio con el que pagó por última vez; nunca sus datos (constitución P3, CA-4.0). */
  ultimoMetodo?: 'tarjeta' | 'yape';
}

const clave = (usuarioId: string) => `perfil_${usuarioId}`;

export const leerPerfil = (usuarioId: string): Perfil => localStore.get<Perfil>(clave(usuarioId)) ?? {};

export function escribirPerfil(usuarioId: string, cambios: Perfil): Perfil {
  const nuevo = { ...leerPerfil(usuarioId), ...cambios };
  localStore.set(clave(usuarioId), nuevo);
  return nuevo;
}
