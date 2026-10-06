import { IconName } from '../../shared/ui/icon/icon';

export type Condicion = 'nuevo' | 'original' | 'compatible';
export type ValorEspecificacion = string | number | boolean | string[];

export interface Imagen {
  url: string;
  alt: string;
  orden: number;
}

export interface Producto {
  id: number;
  sku: string;
  categoria_id: number;
  marca_id: number;
  nombre: string;
  modelo: string;
  descripcion: string;
  numero_parte: string | null;
  /** 2 decimales. En la Fase 2 llega como string y se convierte en `catalog.api.ts`. */
  precio_usd: number;
  stock: number;
  garantia_meses: number;
  condicion: Condicion;
  especificaciones: Record<string, ValorEspecificacion>;
  imagenes: Imagen[];
  destacado: boolean;
  activo: boolean;
  created_at: string;
}

export interface Categoria {
  id: number;
  padre_id: number | null;
  slug: string;
  clave_i18n: string;
  icono: IconName;
  orden: number;
}

export interface Atributo {
  id: number;
  categoria_id: number;
  clave: string;
  clave_i18n: string;
  tipo: 'texto' | 'numero' | 'booleano' | 'lista';
  unidad: string | null;
  valores_permitidos: string[] | null;
  filtrable: boolean;
  /** Marcado con ⚙: lo comparan las specs 003 y 008. */
  usa_compatibilidad: boolean;
  /** Orden en la tabla de especificaciones (patrón F). */
  orden: number;
}

export interface Marca {
  id: number;
  nombre: string;
}

export interface Equipo {
  id: number;
  marca_id: number;
  modelo: string;
  codigo_modelo: string | null;
  especificaciones: Record<string, ValorEspecificacion>;
}

export interface ProductoCompatibilidad {
  producto_id: number;
  equipo_id: number;
  nota: string | null;
}

export interface Catalogo {
  version: number;
  categorias: Categoria[];
  marcas: Marca[];
  atributos: Atributo[];
  productos: Producto[];
}

/**
 * Regla de compatibilidad entre piezas de PC (nivel 1 del modelo de datos, spec 008). Son DATOS: agregar una regla no requiere programar.
 * `origen` admite varias subcategorías (la potencia suma CPU + tarjeta de video) y `margen` se suma al origen (+100 W del resto del sistema).
 */
export interface ReglaCompatibilidad {
  id: number;
  /** Slugs de subcategoría. */
  origen: string[];
  atributo_origen: string;
  operador: 'igual' | 'incluido_en' | 'suma_menor_igual';
  /** Slug de subcategoría. */
  destino: string;
  atributo_destino: string;
  margen?: number;
  /** Clave de traducción del motivo del conflicto. */
  mensaje: string;
}

export interface Compatibilidad {
  version: number;
  equipos: Equipo[];
  producto_compatibilidad: ProductoCompatibilidad[];
  reglas_compatibilidad: ReglaCompatibilidad[];
}

/** `relevancia` solo existe en los resultados de búsqueda (spec 002, CA-3.2): conserva el orden que dio el motor. */
export type Orden = 'destacados' | 'precio-asc' | 'precio-desc' | 'nuevos' | 'relevancia';

/** Lo que el motor de búsqueda necesita del catálogo (spec 002). */
export interface DatosIndice {
  productos: readonly Producto[];
  categorias: readonly Categoria[];
  marcas: readonly Marca[];
  equipos: readonly Equipo[];
  producto_compatibilidad: readonly ProductoCompatibilidad[];
}

export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export type EstadoStock = 'disponible' | 'pocas' | 'agotado';

export interface DetalleCategoria {
  categoria: Categoria;
  padre: Categoria | null;
  hijas: Categoria[];
}

export type EquipoConMarca = Equipo & { marca: string };
