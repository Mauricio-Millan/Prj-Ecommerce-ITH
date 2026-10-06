export type Operador = 'igual' | 'incluido_en' | 'suma_menor_igual';

const norm = (v: unknown) => String(v).trim().toLowerCase();
const falta = (v: unknown) => v === undefined || v === null || v === '';

/**
 * Compara valores de especificaciones sin importar mayúsculas ni espacios. `null` = faltan datos (no es "incompatible").
 * Una sola forma de comparar en toda la tienda: la usan la 003 (laptop ↔ pieza) y la 008 (armador de PC).
 */
export function cumple(operador: Operador, a: unknown, b: unknown): boolean | null {
  if (falta(a) || falta(b)) return null;
  switch (operador) {
    case 'igual':
      return norm(a) === norm(b);
    case 'incluido_en':
      return Array.isArray(b) ? b.some((x) => norm(x) === norm(a)) : null;
    case 'suma_menor_igual':
      return Array.isArray(a) && !Number.isNaN(Number(b)) ? a.reduce((s: number, n) => s + Number(n), 0) <= Number(b) : null;
  }
}
