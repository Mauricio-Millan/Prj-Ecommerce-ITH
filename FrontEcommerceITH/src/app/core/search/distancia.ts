/**
 * Distancia de Damerau-Levenshtein (con transposiciones) entre dos palabras, cortada en 2: solo interesa saber si es 0, 1 o "más de 1"
 * (el motor corrige un solo error de tipeo, CA-1.4).
 */
export function distancia(a: string, b: string): 0 | 1 | 2 {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;

  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return Math.min(d[a.length][b.length], 2) as 0 | 1 | 2;
}
