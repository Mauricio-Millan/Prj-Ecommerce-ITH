import { DatosIndice, Producto, ValorEspecificacion } from '../catalog/catalog.models';
import { compactar, palabras } from './normalize';

/** Peso de cada campo: una coincidencia en el nombre vale más que una en la descripción (plan § 1.2). */
export const PESOS = { nombre: 10, categoria: 8, equipos: 8, marca: 6, especificaciones: 5, descripcion: 1 } as const;

export interface CampoIndexado {
  peso: number;
  palabras: string[];
}

export interface EntradaIndice {
  producto: Producto;
  campos: CampoIndexado[];
}

export interface Indice {
  entradas: EntradaIndice[];
  /** Todas las palabras indexadas: sirve para corregir errores de tipeo. */
  vocabulario: Set<string>;
  /** Códigos (P/N, SKU, modelo) compactados → producto: la coincidencia exacta (CA-2.1). */
  porCodigo: Map<string, Producto>;
}

const valoresComoTexto = (v: ValorEspecificacion): string[] => (typeof v === 'boolean' ? [] : Array.isArray(v) ? v : [String(v)]);

/** Se construye una vez por carga del catálogo (solo productos activos). */
export function construirIndice(datos: DatosIndice): Indice {
  const categoria = new Map(datos.categorias.map((c) => [c.id, c]));
  const marca = new Map(datos.marcas.map((m) => [m.id, m.nombre]));
  const equipo = new Map(datos.equipos.map((e) => [e.id, e]));

  const entradas: EntradaIndice[] = [];
  const vocabulario = new Set<string>();
  const porCodigo = new Map<string, Producto>();

  for (const producto of datos.productos.filter((p) => p.activo)) {
    const sub = categoria.get(producto.categoria_id);
    const raiz = sub?.padre_id ? categoria.get(sub.padre_id) : undefined;
    const equipos = datos.producto_compatibilidad
      .filter((pc) => pc.producto_id === producto.id)
      .flatMap((pc) => {
        const e = equipo.get(pc.equipo_id);
        return e ? palabras(`${marca.get(e.marca_id) ?? ''} ${e.modelo} ${e.codigo_modelo ?? ''}`) : [];
      });

    const campos: CampoIndexado[] = [
      { peso: PESOS.nombre, palabras: palabras(producto.nombre) },
      { peso: PESOS.categoria, palabras: palabras(`${sub?.slug ?? ''} ${raiz?.slug ?? ''}`) },
      { peso: PESOS.equipos, palabras: equipos },
      { peso: PESOS.marca, palabras: palabras(marca.get(producto.marca_id) ?? '') },
      { peso: PESOS.especificaciones, palabras: Object.values(producto.especificaciones).flatMap((v) => valoresComoTexto(v).flatMap(palabras)) },
      { peso: PESOS.descripcion, palabras: palabras(producto.descripcion) },
    ];
    campos.forEach((c) => c.palabras.forEach((p) => vocabulario.add(p)));
    entradas.push({ producto, campos });

    for (const codigo of [producto.numero_parte, producto.sku, producto.modelo]) {
      const c = codigo ? compactar(codigo) : '';
      if (c && !porCodigo.has(c)) porCodigo.set(c, producto);
    }
  }

  return { entradas, vocabulario, porCodigo };
}
