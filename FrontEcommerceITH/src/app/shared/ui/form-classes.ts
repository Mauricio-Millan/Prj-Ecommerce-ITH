/**
 * Clases de los campos de formulario (una sola vez, H4): normal y con error.
 * El borde es `border-control` (≥ 3:1, WCAG 1.4.11); `border` queda para tarjetas y separadores (spec 018 CA-2.2).
 */
const BASE = 'min-h-11 w-full min-w-0 rounded-control border bg-surface px-3 text-sm text-foreground placeholder:text-muted';

export const CAMPO = `${BASE} border-border-control`;
export const CAMPO_ERROR = `${BASE} border-danger`;
