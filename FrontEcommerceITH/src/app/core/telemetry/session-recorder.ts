import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { localStore } from '../storage/local-store';
import { InteractionLogger, claveEventos } from './interaction-logger';
import { puntajeSus } from './metrics';
import { ResultadoTarea, RespuestaSus, Sesion, TareaEnCurso, TareaId } from './telemetry.models';

const KEY = 'research_session';
export const claveSus = (sesionId: string) => `research_sus_${sesionId}`;

/** Códigos de error (claves i18n) que muestra el panel. */
export type ErrorSesion = 'research.error.participante' | 'research.error.version';

interface Guardado {
  sesion: Sesion;
  tarea: TareaEnCurso | null;
  pausada: boolean;
}

/**
 * Estado de la sesión de prueba (signals que lee el panel). Se persiste en `ts_research_session`,
 * así una recarga con `?research=1` retoma la misma sesión sin perder datos.
 */
@Injectable({ providedIn: 'root' })
export class SessionRecorder implements OnDestroy {
  private readonly logger = inject(InteractionLogger);

  readonly sesion = signal<Sesion | null>(null);
  readonly tareaActual = signal<TareaEnCurso | null>(null);
  readonly pausada = signal(false);
  readonly transcurrido = signal(0); // s, se actualiza cada 1 s solo con una tarea abierta
  readonly grabando = computed(() => this.sesion() !== null && !this.pausada());
  readonly sus = signal<RespuestaSus | null>(null);

  private reloj?: ReturnType<typeof setInterval>;

  constructor() {
    const guardado = localStore.get<Guardado>(KEY);
    if (!guardado) return;
    this.sesion.set(guardado.sesion);
    this.tareaActual.set(guardado.tarea);
    this.pausada.set(guardado.pausada);
    this.sus.set(localStore.get<RespuestaSus>(claveSus(guardado.sesion.id)));
    if (!guardado.pausada) this.logger.start(guardado.sesion.id, guardado.sesion.version);
    this.logger.tarea = guardado.tarea?.id ?? null;
    if (guardado.tarea) this.iniciarReloj();
  }

  /** Devuelve la clave del error, o `null` si inició. Solo códigos, nunca nombres (CA-1.2, H5). */
  iniciarSesion(participante: string, version: string): ErrorSesion | null {
    const p = participante.trim().toUpperCase();
    const v = version.trim().toLowerCase();
    if (!/^P\d{2}$/.test(p)) return 'research.error.participante';
    if (!/^v\d+$/.test(v)) return 'research.error.version';
    if (this.sesion()) return null;
    const sesion: Sesion = { id: `${p}-${v}`, participante: p, version: v, inicio: Date.now() };
    this.sesion.set(sesion);
    this.pausada.set(false);
    this.sus.set(localStore.get<RespuestaSus>(claveSus(sesion.id)));
    this.logger.start(sesion.id, v);
    this.persistir();
    return null;
  }

  iniciarTarea(id: TareaId): boolean {
    if (!this.sesion() || this.tareaActual()) return false; // CA-1.4
    this.tareaActual.set({ id, inicio: Date.now() });
    this.logger.tarea = id;
    this.logger.track('task_start');
    this.iniciarReloj();
    this.persistir();
    return true;
  }

  terminarTarea(resultado: ResultadoTarea): void {
    if (!this.tareaActual()) return;
    this.logger.track('task_end', { resultado });
    this.logger.tarea = null;
    this.tareaActual.set(null);
    this.detenerReloj();
    this.persistir();
    this.logger.flush();
  }

  /** Se registra como error de la tarea en curso (CA-1.5). */
  ayudaSolicitada(): void {
    if (this.tareaActual()) this.logger.track('help_requested');
  }

  pausar(): void {
    if (!this.sesion() || this.tareaActual() || this.pausada()) return;
    this.logger.stop();
    this.pausada.set(true);
    this.persistir();
  }

  reanudar(): void {
    const sesion = this.sesion();
    if (!sesion || !this.pausada()) return;
    this.pausada.set(false);
    this.logger.start(sesion.id, sesion.version);
    this.persistir();
  }

  guardarSus(respuestas: number[]): RespuestaSus | null {
    const sesion = this.sesion();
    if (!sesion) return null;
    const resultado: RespuestaSus = { respuestas, puntaje: puntajeSus(respuestas), version: sesion.version, t: Date.now() };
    localStore.set(claveSus(sesion.id), resultado);
    this.sus.set(resultado);
    return resultado;
  }

  /** Cierra la sesión. Los datos siguen en localStorage (se pueden exportar retomando el mismo código). */
  cerrarSesion(): void {
    if (this.tareaActual()) return; // H5: primero se cierra la tarea
    this.logger.stop();
    this.sesion.set(null);
    this.sus.set(null);
    this.pausada.set(false);
    localStore.remove(KEY);
  }

  /** Borra los eventos y el SUS de la sesión y la cierra (CA-3.4). La confirmación la pide el panel. */
  borrarDatos(): void {
    const sesion = this.sesion();
    if (!sesion || this.tareaActual()) return;
    this.logger.borrar(sesion.id);
    localStore.remove(claveEventos(sesion.id));
    localStore.remove(claveSus(sesion.id));
    this.cerrarSesion();
  }

  ngOnDestroy(): void {
    this.detenerReloj();
  }

  private persistir(): void {
    const sesion = this.sesion();
    if (sesion) localStore.set(KEY, { sesion, tarea: this.tareaActual(), pausada: this.pausada() } satisfies Guardado);
  }

  private iniciarReloj(): void {
    this.detenerReloj();
    const tick = () => {
      const tarea = this.tareaActual();
      this.transcurrido.set(tarea ? Math.floor((Date.now() - tarea.inicio) / 1000) : 0);
    };
    tick();
    this.reloj = setInterval(tick, 1000);
  }

  private detenerReloj(): void {
    clearInterval(this.reloj);
    this.transcurrido.set(0);
  }
}
