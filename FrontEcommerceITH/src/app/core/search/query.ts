import { distancia } from './distancia';
import { normalizar } from './normalize';

export interface Sinonimos {
  /** Palabras que no aportan ("para", "mi", "de"). */
  relleno: string[];
  /** Cada grupo es un conjunto de equivalentes; el PRIMER término es el canónico (es lo que se muestra al usuario). */
  grupos: string[][];
}

export interface Consulta {
  original: string;
  /** Sin espacios ni signos, para comparar con códigos: `L19M3-PF4` → `l19m3pf4`. */
  compactada: string;
  /** Una lista de alternativas por palabra de la consulta (sinónimos incluidos). */
  tokens: string[][];
  /** La consulta como la entendió el sistema, solo si cambió respecto de lo escrito (corrección o sinónimo) (CA-3.4). */
  interpretacion: string | null;
}

type Elemento = { g: number } | { w: string };

interface Preparado {
  relleno: Set<string>;
  grupoDe: Map<string, number>;
  alternativas: string[][];
  palabrasDeGrupos: Set<string>;
  maxFrase: number;
}

const cache = new WeakMap<Sinonimos, Preparado>();

function preparar(sin: Sinonimos): Preparado {
  const guardado = cache.get(sin);
  if (guardado) return guardado;

  const relleno = new Set(sin.relleno.map(normalizar));
  const grupoDe = new Map<string, number>();
  const palabrasDeGrupos = new Set<string>();
  let maxFrase = 1;

  const alternativas = sin.grupos.map((grupo, g) => {
    const unicas = new Set<string>();
    for (const termino of grupo) {
      const completo = normalizar(termino);
      grupoDe.set(completo, g);
      const ps = completo.split(' ');
      maxFrase = Math.max(maxFrase, ps.length);
      ps.forEach((p) => palabrasDeGrupos.add(p));
      // Al comparar, las palabras de relleno de un término no cuentan ("tarjeta de video" → tarjeta video).
      const sinRelleno = ps.filter((p) => !relleno.has(p));
      unicas.add((sinRelleno.length ? sinRelleno : ps).join(' '));
    }
    return [...unicas];
  });

  const preparado = { relleno, grupoDe, alternativas, palabrasDeGrupos, maxFrase };
  cache.set(sin, preparado);
  return preparado;
}

/**
 * Interpreta lo que escribió el usuario (plan § 2.1):
 * 1. normaliza; 2. reemplaza frases y términos de los grupos por su grupo (la frase más larga primero);
 * 3. quita el relleno; 4. corrige errores de UNA letra en palabras de 5 o más letras que el catálogo no conoce
 *    (nunca códigos: palabras con números); 5. expande cada grupo a sus equivalentes.
 * Con `exacto` se saltan los pasos 2, 4 y 5 (enlace "Buscar exactamente…").
 */
export function interpretar(texto: string, sin: Sinonimos, vocabulario: ReadonlySet<string>, { exacto = false } = {}): Consulta {
  const p = preparar(sin);
  const original = normalizar(texto);
  const crudas = original.split(' ').filter(Boolean);

  let elementos: Elemento[] = [];
  if (exacto) {
    elementos = crudas.map((w) => ({ w }));
  } else {
    for (let i = 0; i < crudas.length; ) {
      let g: number | undefined;
      let n = Math.min(p.maxFrase, crudas.length - i);
      for (; n >= 1; n--) {
        g = p.grupoDe.get(crudas.slice(i, i + n).join(' '));
        if (g !== undefined) break;
      }
      if (g !== undefined) {
        elementos.push({ g });
        i += n;
      } else {
        elementos.push({ w: crudas[i] });
        i++;
      }
    }
  }

  elementos = elementos.filter((e) => 'g' in e || !p.relleno.has(e.w));

  if (!exacto) {
    const conocida = (w: string) => vocabulario.has(w) || p.palabrasDeGrupos.has(w) || [...vocabulario].some((v) => v.startsWith(w));
    const candidatas = () => [...new Set([...vocabulario, ...p.palabrasDeGrupos])].sort();
    elementos = elementos.map((e) => {
      if ('g' in e || e.w.length < 5 || /\d/.test(e.w) || conocida(e.w)) return e;
      const cercana = candidatas().find((c) => Math.abs(c.length - e.w.length) <= 1 && distancia(e.w, c) === 1);
      if (!cercana) return e;
      const g = p.grupoDe.get(cercana);
      return g !== undefined ? { g } : { w: cercana };
    });
  }

  const tokens = elementos.map((e) => ('g' in e ? p.alternativas[e.g] : [e.w]));

  let interpretacion: string | null = null;
  if (!exacto && elementos.length) {
    const texto = elementos.map((e) => ('g' in e ? sin.grupos[e.g][0] : e.w)).join(' ');
    const normal = normalizar(texto);
    const sinRelleno = crudas.filter((w) => !p.relleno.has(w)).join(' ');
    if (normal !== original && normal !== sinRelleno) interpretacion = texto;
  }

  return { original, compactada: original.replaceAll(' ', ''), tokens, interpretacion };
}
