/** Minúsculas, sin tildes, sin signos y con espacios simples. Los plurales se resuelven por prefijo en el motor, no aquí. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Además quita los espacios: `L19M3-PF4` y `l19m3 pf4` dan lo mismo (CA-2.1). */
export const compactar = (codigo: string) => normalizar(codigo).replaceAll(' ', '');

export const palabras = (texto: string) => normalizar(texto).split(' ').filter(Boolean);
