import { Equipo, Producto } from '../catalog/catalog.models';
import { compactar, normalizar } from '../search/normalize';

export type OrigenEscaneo = 'buscador' | 'mi-equipo' | 'inventario';

export type ResolucionCodigo =
  | { tipo: 'producto'; producto: Producto }
  | { tipo: 'varios'; productos: Producto[] }
  | { tipo: 'equipo'; equipos: Equipo[] }
  /** `modelo`: la dirección nombra un modelo de laptop que aún no está en el catálogo (ej.: `?model2Name=UM3406HA`). */
  | { tipo: 'externo'; url: string; modelo?: string }
  | { tipo: 'ninguno' };

/** Dígito verificador de EAN-8, UPC-A (12) y EAN-13 (spec 014, plan § 3). Otros largos no son EAN. */
export function eanValido(codigo: string): boolean {
  if (!/^\d+$/.test(codigo) || ![8, 12, 13].includes(codigo.length)) return false;
  const digitos = [...codigo].map(Number);
  const control = digitos.pop()!;
  // Desde la derecha de los datos, el primer dígito pesa 3 y el siguiente 1, y así.
  const suma = digitos.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}

/** Un EAN y su UPC-A son el mismo código con un cero delante (CA-1.7): se comparan sin ceros a la izquierda. */
const clave = (codigo: string): string => {
  const c = compactar(codigo);
  return /^\d+$/.test(c) ? c.replace(/^0+/, '') : c;
};

const esNumerico = (c: string) => /^\d+$/.test(c);

/** Una lectura numérica con aspecto de EAN pero con el dígito mal es casi siempre una mala lectura: no se busca (H5). */
const lecturaDudosa = (c: string) => esNumerico(c) && [8, 12, 13].includes(c.length) && !eanValido(c);

/** Un modelo más corto que esto aparecería por casualidad dentro de cualquier texto largo. */
const MIN_CARACTERES_MODELO = 4;

const codigosDe = (e: Equipo): string[] => [e.modelo, e.codigo_modelo ?? '', ...(e.codigos ?? [])].filter(Boolean);

/**
 * Equipos que identifica un texto. Primero por igualdad exacta (la etiqueta trae solo el modelo); si no, porque el modelo o el código
 * **aparece dentro** del texto como palabra completa: el QR de una laptop suele ser una dirección o una línea larga (modelo, serie, fecha).
 * Palabra completa y no subcadena: los tokens aleatorios de una dirección (`qsid=kI5Wl9…`) podrían contener un código corto como `82H8`.
 */
function equiposEn(texto: string, equipos: readonly Equipo[]): Equipo[] {
  const k = clave(texto);
  const exactos = equipos.filter((e) => codigosDe(e).some((x) => clave(x) === k));
  if (exactos.length) return exactos;
  const conBordes = (s: string) => ` ${normalizar(s)} `;
  const palabras = conBordes(texto);
  return equipos.filter((e) => codigosDe(e).some((x) => compactar(x).length >= MIN_CARACTERES_MODELO && palabras.includes(conBordes(x))));
}

/** Parámetros con los que los fabricantes nombran el modelo en la dirección del QR: `model`, `modelName`, `model2Name` (ASUS), `modelo`. */
const PARAM_MODELO = /^model/i;

/** El modelo que nombra una dirección, si lo hace. Solo se aceptan valores con aspecto de modelo (letras, números y guiones). */
function modeloEnDireccion(bruto: string): string | undefined {
  try {
    for (const [nombre, valor] of new URL(bruto).searchParams) {
      if (PARAM_MODELO.test(nombre) && /^[a-z0-9][a-z0-9 _-]{3,39}$/i.test(valor.trim())) return valor.trim();
    }
  } catch {
    /* dirección mal formada: no nombra nada */
  }
  return undefined;
}

/** Una dirección puede traer `%20` y similares; si está mal escapada se usa tal cual. */
const decodificar = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export interface CatalogoEscaneable {
  productos: readonly Producto[];
  equipos: readonly Equipo[];
}

/**
 * Resuelve un código leído (cámara, lector USB o escrito) contra el catálogo (spec 014, CA-1.5 a 1.8, 3.2 a 3.4).
 * - Un QR con dirección web solo se acepta si es de la tienda (`origenTienda`) y apunta a `/producto/<sku>` (CA-1.8).
 * - `origen: 'mi-equipo'` busca equipos; los demás orígenes buscan productos (SKU, número de parte, código de barras).
 * En la Fase 2 esta función se sustituye por `GET /api/v1/codigos/{codigo}`.
 */
export function resolverCodigo(texto: string, datos: CatalogoEscaneable, origen: OrigenEscaneo, origenTienda = ''): ResolucionCodigo {
  const bruto = texto.trim();
  if (!bruto) return { tipo: 'ninguno' };

  if (/^https?:\/\//i.test(bruto)) {
    try {
      const url = new URL(bruto);
      if (origenTienda && url.origin === origenTienda) {
        const sku = decodeURIComponent(url.pathname.split('/producto/')[1]?.split('/')[0] ?? '');
        if (sku) return resolverCodigo(sku, datos, origen);
      }
    } catch {
      /* dirección mal formada: se trata como externa */
    }
    // Un QR de otro sitio no se abre, pero puede nombrar el modelo de la laptop (ej.: soporte del fabricante con el modelo en la dirección).
    // El parámetro de modelo manda: es más preciso que el resto de la dirección.
    const modelo = modeloEnDireccion(bruto);
    const porModelo = modelo ? equiposEn(modelo, datos.equipos) : [];
    const deEquipo = porModelo.length ? porModelo : equiposEn(decodificar(bruto), datos.equipos);
    return deEquipo.length ? { tipo: 'equipo', equipos: deEquipo } : { tipo: 'externo', url: bruto, ...(modelo ? { modelo } : {}) };
  }

  const c = compactar(bruto);
  if (!c || lecturaDudosa(c)) return { tipo: 'ninguno' };
  const k = clave(bruto);

  if (origen === 'mi-equipo') {
    const equipos = equiposEn(bruto, datos.equipos);
    return equipos.length ? { tipo: 'equipo', equipos } : { tipo: 'ninguno' };
  }

  const productos = datos.productos.filter((p) => p.activo !== false && [p.sku, p.numero_parte ?? '', p.codigo_barras ?? ''].some((x) => x && clave(x) === k));
  if (productos.length === 1) return { tipo: 'producto', producto: productos[0] };
  if (productos.length) return { tipo: 'varios', productos };
  // Ningún producto: si es la etiqueta o el QR de una laptop, se reconoce el equipo (se usa para ver sus repuestos).
  const equipos = equiposEn(bruto, datos.equipos);
  return equipos.length ? { tipo: 'equipo', equipos } : { tipo: 'ninguno' };
}
