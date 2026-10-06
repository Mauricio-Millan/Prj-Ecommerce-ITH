import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SessionApi } from '../../../auth/session.api';
import { localStore } from '../../../storage/local-store';
import { exportarSesion } from '../../exporters';
import { InteractionLogger } from '../../interaction-logger';
import { ErrorSesion, SessionRecorder } from '../../session-recorder';
import { TAREAS, TareaId } from '../../telemetry.models';
import { HeatmapViewer } from '../heatmap-viewer/heatmap-viewer';
import { SusForm } from '../sus-form/sus-form';

const UI_KEY = 'research_ui';
/** Claves que "Restaurar datos de ejemplo" conserva (CA-1.8). */
const CONSERVAR = (k: string) => k.startsWith('research_') || k === 'lang' || k === 'currency';

/** Cuentas de prueba (spec 006 plan § 1.1): cliente1 sin DNI (cuenta de la T2), cliente2 con DNI, admin. */
const CUENTAS_PRUEBA = ['cliente1@gmail.com', 'cliente2@gmail.com', 'admin@techsuply.pe'];

const BTN ='min-h-9 rounded-control border border-border px-2 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Panel del moderador (spec 012, HU-1/3/5). Solo existe con `?research=1` (se importa dinámicamente desde `app.ts`).
 * Raíz con `data-research-panel`: nada de lo que pasa aquí se registra como interacción con la tienda (CA-1.7).
 */
@Component({
  selector: 'app-research-panel',
  imports: [TranslocoPipe, HeatmapViewer, SusForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-research-panel': '' },
  template: `
    @if (plegado()) {
      <!-- Plegado: un indicador mínimo en la esquina (CA-1.6) -->
      <button
        type="button"
        class="fixed bottom-2 left-2 z-40 flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-xs shadow-card"
        [attr.aria-label]="'research.expand' | transloco"
        (click)="plegar(false)"
      >
        <span aria-hidden="true" [class.text-danger]="rec.grabando()" [class.text-muted]="!rec.grabando()">●</span>
        {{ rec.grabando() ? ('research.rec' | transloco) : rec.sesion() ? ('research.paused' | transloco) : ('research.idle' | transloco) }}
      </button>
    } @else {
      <section
        class="fixed bottom-2 left-2 z-40 max-h-[calc(100dvh-1rem)] w-72 overflow-y-auto rounded-card border border-border bg-surface p-3 text-sm shadow-overlay"
        [attr.aria-label]="'research.title' | transloco"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ 'research.title' | transloco }}</h2>
          <button type="button" [class]="btn" (click)="plegar(true)">{{ 'research.collapse' | transloco }}</button>
        </div>

        @if (rec.sesion(); as sesion) {
          <!-- Estado siempre visible (H1) -->
          <p class="mt-2 flex items-center gap-1 font-medium">
            <span aria-hidden="true" [class.text-danger]="rec.grabando()" [class.text-muted]="!rec.grabando()">●</span>
            {{ rec.grabando() ? ('research.recording' | transloco) : ('research.paused' | transloco) }} · {{ sesion.id }}
          </p>
          <p class="text-xs text-muted">
            {{ 'research.events' | transloco: { n: logger.stats().eventos } }} · {{ 'research.storage' | transloco: { p: logger.stats().porcentaje } }}
          </p>
          @if (logger.stats().lleno) {
            <p class="mt-1 text-xs font-medium text-danger" role="alert">{{ 'research.storageFull' | transloco }}</p>
          } @else if (logger.stats().porcentaje >= 80) {
            <p class="mt-1 text-xs font-medium text-warning" role="alert">{{ 'research.storageWarning' | transloco }}</p>
          }

          <div class="mt-3 border-t border-border pt-3">
            @if (rec.tareaActual(); as tarea) {
              <p class="font-medium">{{ 'research.current' | transloco: { tarea: tarea.id } }} · <span class="tabular-nums">{{ cronometro() }}</span></p>
            } @else {
              <label class="flex items-center gap-2">
                {{ 'research.task' | transloco }}
                <select class="min-h-9 rounded-control border border-border px-1" (change)="tarea.set($any($event.target).value)">
                  @for (t of tareas; track t) {
                    <option [value]="t" [selected]="t === tarea()">{{ t }}</option>
                  }
                </select>
                <button type="button" [class]="btn" [disabled]="rec.pausada()" (click)="rec.iniciarTarea(tarea())">{{ 'research.startTask' | transloco }}</button>
              </label>
            }
            <div class="mt-2 grid grid-cols-3 gap-1">
              <button type="button" [class]="btn" [disabled]="!rec.tareaActual()" (click)="rec.terminarTarea('exito')">{{ 'research.success' | transloco }}</button>
              <button type="button" [class]="btn" [disabled]="!rec.tareaActual()" (click)="rec.terminarTarea('fracaso')">{{ 'research.failure' | transloco }}</button>
              <button type="button" [class]="btn" [disabled]="!rec.tareaActual()" (click)="rec.terminarTarea('abandono')">{{ 'research.abandon' | transloco }}</button>
            </div>
            <button type="button" class="mt-1 w-full" [class]="btn" [disabled]="!rec.tareaActual()" (click)="rec.ayudaSolicitada()">{{ 'research.help' | transloco }}</button>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-3">
            @if (rec.pausada()) {
              <button type="button" [class]="btn" (click)="rec.reanudar()">{{ 'research.resume' | transloco }}</button>
            } @else {
              <button type="button" [class]="btn" [disabled]="!!rec.tareaActual()" (click)="rec.pausar()">{{ 'research.pause' | transloco }}</button>
            }
            <button type="button" [class]="btn" [disabled]="!!rec.tareaActual()" (click)="susAbierto.set(true)">{{ 'research.susOpen' | transloco }}</button>
            <button type="button" [class]="btn" [disabled]="!!rec.tareaActual()" (click)="exportar()">{{ 'research.export' | transloco }}</button>
            <button type="button" [class]="btn" [disabled]="!!rec.tareaActual()" (click)="rec.cerrarSesion()">{{ 'research.close' | transloco }}</button>
          </div>
          @if (rec.sus(); as sus) {
            <p class="mt-1 text-xs text-muted">{{ 'research.susDone' | transloco: { puntaje: sus.puntaje } }}</p>
          }
          <button type="button" class="mt-1 w-full text-danger" [class]="btn" [disabled]="!!rec.tareaActual()" (click)="borrar(sesion.id)">
            {{ 'research.delete' | transloco }}
          </button>
        } @else {
          <form class="mt-2 grid gap-2" (submit)="iniciar($event, participante.value, version.value)">
            <label class="grid gap-1">
              {{ 'research.participant' | transloco }}
              <input #participante autocomplete="off" placeholder="P01" maxlength="3" class="min-h-9 rounded-control border border-border px-2 uppercase" aria-describedby="research-p-hint" />
              <span id="research-p-hint" class="text-xs text-muted">{{ 'research.participantHint' | transloco }}</span>
            </label>
            <label class="grid gap-1">
              {{ 'research.version' | transloco }}
              <input #version autocomplete="off" value="v1" maxlength="4" class="min-h-9 rounded-control border border-border px-2" aria-describedby="research-v-hint" />
              <span id="research-v-hint" class="text-xs text-muted">{{ 'research.versionHint' | transloco }}</span>
            </label>
            @if (error(); as e) {
              <p class="text-xs font-medium text-danger" role="alert">{{ e | transloco }}</p>
            }
            <button type="submit" class="min-h-9 rounded-control bg-primary px-3 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'research.start' | transloco }}</button>
          </form>
        }

        <div class="mt-3 grid gap-1 border-t border-border pt-3">
          <label class="flex items-center gap-2">
            {{ 'research.simulatedUser' | transloco }}
            <select class="min-h-9 flex-1 rounded-control border border-border px-1" (change)="cambiarUsuario($any($event.target).value)">
              <option value="" [selected]="!usuario()">{{ 'research.noUser' | transloco }}</option>
              @for (email of cuentasPrueba; track email) {
                <option [value]="email" [selected]="usuario()?.email === email">{{ email }}</option>
              }
            </select>
          </label>
          <button type="button" [class]="btn" (click)="mapaAbierto.set(!mapaAbierto())">{{ 'research.heatmap' | transloco }}</button>
          <button type="button" [class]="btn" [disabled]="!!rec.tareaActual()" (click)="restaurar()">{{ 'research.restore' | transloco }}</button>
        </div>
      </section>
    }

    @if (mapaAbierto()) {
      <app-heatmap-viewer (cerrar)="mapaAbierto.set(false)" />
    }
    @if (susAbierto()) {
      <app-sus-form (enviado)="guardarSus($event)" (cancelar)="susAbierto.set(false)" />
    }
  `,
})
export class ResearchPanel {
  protected readonly rec = inject(SessionRecorder);
  protected readonly logger = inject(InteractionLogger);
  private readonly session = inject(SessionApi);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  protected readonly btn = BTN;
  protected readonly tareas = TAREAS;
  protected readonly cuentasPrueba = CUENTAS_PRUEBA;
  protected readonly tarea = signal<TareaId>('T1');
  protected readonly error = signal<ErrorSesion | null>(null);
  protected readonly plegado = signal(localStore.get<boolean>(UI_KEY) ?? true); // plegado al abrir (CA-1.1)
  protected readonly mapaAbierto = signal(false);
  protected readonly susAbierto = signal(false);
  protected readonly usuario = this.session.usuario;

  protected readonly cronometro = computed(() => {
    const s = this.rec.transcurrido();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  protected plegar(valor: boolean): void {
    this.plegado.set(valor);
    localStore.set(UI_KEY, valor);
  }

  protected iniciar(event: Event, participante: string, version: string): void {
    event.preventDefault();
    this.error.set(this.rec.iniciarSesion(participante, version));
  }

  protected exportar(): void {
    const sesion = this.rec.sesion();
    if (!sesion) return;
    this.logger.flush();
    exportarSesion(sesion.id, this.logger.eventos(), this.rec.sus());
  }

  protected borrar(sesionId: string): void {
    if (confirm(this.transloco.translate('research.confirmDelete', { sesion: sesionId }))) this.rec.borrarDatos();
  }

  protected guardarSus(respuestas: number[]): void {
    this.rec.guardarSus(respuestas);
    this.susAbierto.set(false);
  }

  protected cambiarUsuario(email: string): void {
    if (email) this.session.iniciarComo(email).subscribe();
    else this.session.cerrarSesion();
  }

  /** Borra todo `ts_*` salvo investigación e idioma/moneda, y recarga para cargar las semillas (CA-1.8). */
  protected restaurar(): void {
    if (!confirm(this.transloco.translate('research.confirmRestore'))) return;
    this.logger.flush();
    localStore.keys().filter((k) => !CONSERVAR(k)).forEach((k) => localStore.remove(k));
    const loc = this.document.location;
    loc.assign(loc.pathname + '?research=1');
  }
}
