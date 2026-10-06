export type PasoId = 'cpu' | 'placa' | 'ram' | 'gpu' | 'almacenamiento' | 'fuente' | 'case' | 'cooler';

export interface PasoDef {
  id: PasoId;
  /** Slug de la subcategoría del catálogo. */
  slug: string;
  /** Atributos que se muestran en la lista de piezas del paso (CA-2.1). */
  specs: string[];
}

/** El orden natural de armado (CA-1.1). Las claves de texto son `builder.step.<id>` y `builder.help.<id>` (CA-1.3). */
export const PASOS: readonly PasoDef[] = [
  { id: 'cpu', slug: 'procesadores', specs: ['socket', 'nucleos', 'graficos_integrados'] },
  { id: 'placa', slug: 'placas-madre', specs: ['socket', 'tipo_ram', 'factor_forma'] },
  { id: 'ram', slug: 'memoria-ram-pc', specs: ['tipo_ram', 'capacidad_gb', 'velocidad_mhz'] },
  { id: 'gpu', slug: 'tarjetas-de-video', specs: ['chip', 'memoria_gb', 'consumo_w'] },
  { id: 'almacenamiento', slug: 'almacenamiento', specs: ['tipo_almacenamiento', 'interfaz', 'capacidad_gb'] },
  { id: 'fuente', slug: 'fuentes-de-poder', specs: ['potencia_w', 'certificacion_80plus'] },
  { id: 'case', slug: 'cases', specs: ['factores_soportados'] },
  { id: 'cooler', slug: 'refrigeracion', specs: ['tipo_refrigeracion', 'sockets_soportados'] },
];

export const PASO_RESUMEN = 'resumen' as const;
export type PasoActual = PasoId | typeof PASO_RESUMEN;

export const defDePaso = (id: PasoId): PasoDef => PASOS.find((p) => p.id === id)!;
export const pasoDeSlug = (slug: string): PasoId | null => PASOS.find((p) => p.slug === slug)?.id ?? null;
export const ordenDe = (id: PasoId): number => PASOS.findIndex((p) => p.id === id);
