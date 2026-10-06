/**
 * Cálculo de dinero en CÉNTIMOS ENTEROS (plan de la 005 § 1). Única fuente del cálculo para el precio
 * mostrado (000), el carrito (005) y el pedido (006): así lo que se ve coincide al céntimo con lo que se paga.
 */

/** USD con 2 decimales → entero exacto. */
export const aCentimos = (monto: number) => Math.round(monto * 100);

/** Tipo de cambio con hasta 4 decimales → entero. */
export const tcEntero = (tc: number) => Math.round(tc * 10_000);

/** Precio unitario en soles, en céntimos: round(usd × tc), mitad hacia arriba. */
export const precioPenCentimos = (usd: number, tc: number) => Math.round((aCentimos(usd) * tcEntero(tc)) / 10_000);

export const subtotalCentimos = (precioCentimos: number, cantidad: number) => precioCentimos * cantidad;

/** Solo para mostrar. */
export const deCentimos = (c: number) => c / 100;
