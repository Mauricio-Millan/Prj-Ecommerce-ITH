import { Producto } from '../catalog/catalog.models';
import { Consulta } from './query';
import { CampoIndexado, Indice } from './search-index';

export interface ResultadoProducto {
  producto: Producto;
  puntaje: number;
  /** Fracción de las palabras de la consulta que se encontraron (0–1). */
  cobertura: number;
}

export interface ResultadoBusqueda {
  /** El producto cuyo P/N, SKU o modelo es EXACTAMENTE lo escrito: va aparte, primero (CA-2.1). */
  exacta: Producto | null;
  /** Los demás, del más al menos relevante. No incluye a `exacta`. */
  resultados: ResultadoProducto[];
  interpretacion: string | null;
}

const COBERTURA_MINIMA = 0.5;

/**
 * Una palabra de la consulta coincide con una del índice si es igual, o si tiene 4 letras o más y la del índice EMPIEZA con ella
 * (plurales y palabras cortadas: tarjeta → tarjetas, inalam → inalambrico). Las de 3 letras o menos y las de solo números
 * cuentan únicamente si son iguales ("ram" no encuentra "ramas"; "3" no encuentra "330").
 */
export const coincide = (q: string, palabra: string) => q === palabra || (q.length >= 4 && !/^\d+$/.test(q) && palabra.startsWith(q));

/** Una alternativa de varias palabras ("tarjeta video") exige que TODAS aparezcan en el mismo campo. */
const coincideAlternativa = (alternativa: string, campo: CampoIndexado) =>
  alternativa.split(' ').every((q) => campo.palabras.some((p) => coincide(q, p)));

/**
 * Puntaje: por cada palabra de la consulta se toma el MAYOR peso entre los campos donde coincide alguna de sus alternativas;
 * `puntaje = Σ pesos × cobertura²`. Se devuelven los productos con cobertura ≥ 0.5; si ninguno llega, los que tengan alguna coincidencia.
 */
export function buscar(indice: Indice, consulta: Consulta): ResultadoBusqueda {
  const exacta = consulta.compactada ? (indice.porCodigo.get(consulta.compactada) ?? null) : null;
  const total = consulta.tokens.length;
  const todos: ResultadoProducto[] = [];

  if (total > 0) {
    for (const { producto, campos } of indice.entradas) {
      if (producto === exacta) continue;
      let suma = 0;
      let encontradas = 0;
      for (const alternativas of consulta.tokens) {
        let mejor = 0;
        for (const campo of campos) {
          if (campo.peso > mejor && alternativas.some((alt) => coincideAlternativa(alt, campo))) mejor = campo.peso;
        }
        if (mejor > 0) {
          suma += mejor;
          encontradas++;
        }
      }
      if (encontradas === 0) continue;
      const cobertura = encontradas / total;
      todos.push({ producto, puntaje: suma * cobertura ** 2, cobertura });
    }
  }

  const buenos = todos.filter((r) => r.cobertura >= COBERTURA_MINIMA);
  const resultados = (buenos.length ? buenos : todos).sort(
    (a, b) => b.puntaje - a.puntaje || Number(b.producto.stock > 0) - Number(a.producto.stock > 0) || a.producto.id - b.producto.id,
  );

  return { exacta, resultados, interpretacion: consulta.interpretacion };
}
