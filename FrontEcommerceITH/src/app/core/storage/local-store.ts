/**
 * Único acceso a `localStorage` (constitución, Fase 1, regla 2).
 * Toda clave lleva el prefijo `ts_`. Nunca lanza: en navegación privada, con el almacenamiento lleno
 * o fuera del navegador, `get` devuelve `null` y `set` devuelve `false`.
 */
const PREFIX = 'ts_';

export const localStore = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  },

  /** Claves propias (sin el prefijo `ts_`). */
  keys(): string[] {
    try {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .map((k) => k.slice(PREFIX.length));
    } catch {
      return [];
    }
  },
};
