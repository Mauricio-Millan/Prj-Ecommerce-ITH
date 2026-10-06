export type TareaId = 'T1' | 'T2' | 'T3';
export type ResultadoTarea = 'exito' | 'fracaso' | 'abandono';

export type TipoEvento =
  | 'click' | 'mouse_move' | 'zone_enter' | 'zone_leave' | 'page_enter' | 'page_leave' | 'visibility' | 'scroll'
  | 'task_start' | 'task_end' | 'help_requested'
  // Eventos de negocio que emiten las páginas (CA-2.7). `search` lleva `q` (≤ 100 caracteres): única excepción de la CA-2.9.
  | 'search' | 'add_to_cart' | 'remove_from_cart' | 'undo' | 'form_error' | 'back_navigation'
  | 'filter' // 002
  | 'equipo_set' | 'compat_warning' // 003
  | 'auth_result' // 004
  | 'cart_quantity' // 005
  | 'checkout_step' | 'payment_method' | 'payment_result' // 006
  | 'reorder' // 007
  | 'builder_select' | 'builder_conflict' | 'builder_complete'; // 008

/** Claves cortas para ahorrar espacio en localStorage (plan § 3.5). El CSV usa cabeceras legibles. */
export interface Evento {
  s: string; // sesión "P03-v1"
  t: number; // ms (performance.timeOrigin + performance.now())
  e: TipoEvento;
  v: string; // versión "v1"
  r: string; // ruta exacta
  p: string; // patrón de ruta "/producto/:id"
  k?: TareaId;
  x?: number;
  y?: number;
  f?: 1; // fijo o sticky: x/y relativos a la ventana
  z?: string; // data-zone
  zi?: number; // índice entre zonas del mismo nombre (solo clics)
  zx?: number;
  zy?: number; // posición relativa en la zona (0–1)
  m?: string; // data-modal abierto
  tr?: string; // data-track
  d?: Record<string, unknown>;
}

export interface Sesion {
  id: string; // `${participante}-${version}`
  participante: string;
  version: string;
  inicio: number;
}

export interface TareaEnCurso {
  id: TareaId;
  inicio: number;
}

export interface ResumenTarea {
  tarea: TareaId;
  tiempoS: number;
  resultado: ResultadoTarea | null;
  errores: number;
  clics: number;
  clicsIdeales: number;
  razonClics: number | null;
}

export interface RespuestaSus {
  respuestas: number[]; // 10 valores de 1 a 5
  puntaje: number;
  version: string;
  t: number;
}

/** Clics del camino ideal por tarea. PROVISIONAL hasta las specs 001–008 (0 = sin definir → razón `null`). */
export const CAMINOS_IDEALES: Record<TareaId, number> = { T1: 0, T2: 0, T3: 0 };

export const TAREAS: readonly TareaId[] = ['T1', 'T2', 'T3'];
