/** Lleva el foco al buscador del encabezado (salida de "sin resultados" y de "no encontrado"). */
export const enfocarBuscador = (doc: Document) => doc.getElementById('buscador')?.focus();
