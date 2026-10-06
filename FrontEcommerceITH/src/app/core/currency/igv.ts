export const IGV_TASA = 0.18;

/**
 * Desglose de un total que YA incluye IGV (constitución § 3.3): el IGV se desglosa desde el total, no se suma.
 * Todo en céntimos enteros; `opGravada + igv === total` siempre.
 */
export function desglosarIgv(totalCentimos: number): { opGravada: number; igv: number } {
  const opGravada = Math.round((totalCentimos * 100) / 118);
  return { opGravada, igv: totalCentimos - opGravada };
}
