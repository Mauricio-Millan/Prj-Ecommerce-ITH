import { PasoActual, PasoId } from './pasos';

/** El armado en curso (`ts_armador`). No se guarda en la cuenta (modelo-datos D15). */
export interface Armado {
  /** sku elegido, o `omitido`. Un paso sin entrada está pendiente. */
  piezas: Partial<Record<PasoId, string>>;
  /** En soles, en céntimos. `null` = sin presupuesto (opcional, CA-3.3). */
  presupuestoCentimos: number | null;
  pasoActual: PasoActual;
}

export const OMITIDO = 'omitido';
export const ARMADO_VACIO: Armado = { piezas: {}, presupuestoCentimos: null, pasoActual: 'cpu' };

/** Por qué una pieza no calza. `mensaje` es la clave `builder.conflict.*` de la regla y `esta`/`otra` sus valores (para el texto). */
export interface Motivo {
  reglaId: number;
  mensaje: string;
  /** El otro paso involucrado ("tu procesador"). */
  otroPaso: PasoId;
  esta: string;
  otra: string;
  /** Solo la regla de potencia. */
  consumoW?: number;
  potenciaW?: number;
}

export interface Conflicto {
  reglaId: number;
  /** Todos los pasos involucrados que tienen pieza. */
  pasos: PasoId[];
  /** El paso que se marca con ⚠: el último del orden de armado entre los involucrados (placa, RAM, case, cooler o fuente). */
  afectado: PasoId;
  motivo: Motivo;
}

export interface Candidata {
  sku: string;
  compatible: boolean;
  /** Alguna regla no se pudo verificar por falta de datos: no la descarta, pero se avisa (como la 003). */
  sinDatos: boolean;
  motivos: Motivo[];
}

export type Obligatoriedad = { obligatorio: boolean; motivo: 'sin_igpu' | 'con_igpu' | 'sin_disipador' | 'con_disipador' | null };

export interface EstadoArmado {
  faltantes: PasoId[];
  conflictos: Conflicto[];
  noDisponibles: PasoId[];
  completo: boolean;
  /** Suma de los precios en soles (o en USD si no hay tipo de cambio), en céntimos. */
  totalCentimos: number;
  consumoW: number;
  potenciaW: number | null;
  /** `null` si no hay presupuesto; negativo si se pasa. */
  restanteCentimos: number | null;
}
