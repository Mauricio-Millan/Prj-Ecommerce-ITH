import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export type ToastTipo = 'info' | 'exito' | 'advertencia' | 'error';

export interface ToastAccion {
  /** Clave de traducción del botón. */
  clave: string;
  ejecutar: () => void;
  /** `data-track` del botón (spec 012). */
  track?: string;
}

export interface Aviso {
  id: number;
  /** Clave de traducción (constitución: nada de texto escrito en código). */
  clave: string;
  tipo: ToastTipo;
  acciones: ToastAccion[];
  params?: Record<string, unknown>;
  /** Se llama si el aviso se cierra (✕) o vence SIN que se use ninguna acción. */
  alIgnorar?: () => void;
}

export interface OpcionesToast {
  duracionMs?: number;
  /** El temporizador se detiene mientras el aviso tiene el foco o el puntero encima (accesibilidad, spec 003). */
  pausarAlEnfocar?: boolean;
  alIgnorar?: () => void;
}

const DURACION_MS = 6000;

interface Reloj {
  timer?: ReturnType<typeof setTimeout>;
  restante: number;
  desde: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 0;
  readonly avisos = signal<Aviso[]>([]);
  private readonly relojes = new Map<number, Reloj>();
  private readonly pausables = new Set<number>();

  show(clave: string, tipo: ToastTipo = 'info', acciones: ToastAccion[] = [], params?: Record<string, unknown>, opciones: OpcionesToast = {}): void {
    const id = ++this.siguienteId;
    this.avisos.update((lista) => [...lista, { id, clave, tipo, acciones, params, alIgnorar: opciones.alIgnorar }]);
    if (opciones.pausarAlEnfocar) this.pausables.add(id);
    this.relojes.set(id, { restante: opciones.duracionMs ?? DURACION_MS, desde: 0 });
    this.arrancar(id);
  }

  private arrancar(id: number): void {
    const reloj = this.relojes.get(id);
    if (!reloj) return;
    reloj.desde = Date.now();
    reloj.timer = setTimeout(() => this.cerrar(id), reloj.restante);
  }

  /** Detiene el temporizador mientras el aviso tiene el foco o el puntero encima (solo los que lo pidieron). */
  pausar(id: number): void {
    const reloj = this.relojes.get(id);
    if (!reloj || !this.pausables.has(id) || reloj.timer === undefined) return;
    clearTimeout(reloj.timer);
    reloj.timer = undefined;
    reloj.restante = Math.max(1000, reloj.restante - (Date.now() - reloj.desde));
  }

  reanudar(id: number): void {
    const reloj = this.relojes.get(id);
    if (reloj && this.pausables.has(id) && reloj.timer === undefined) this.arrancar(id);
  }

  /** Cierra el aviso; si nadie usó una acción se avisa a `alIgnorar`. */
  cerrar(id: number, usado = false): void {
    const aviso = this.avisos().find((a) => a.id === id);
    if (!aviso) return;
    clearTimeout(this.relojes.get(id)?.timer);
    this.relojes.delete(id);
    this.pausables.delete(id);
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
    if (!usado) aviso.alIgnorar?.();
  }

  /** Ejecuta la acción y cierra el aviso: así no se puede usar dos veces (p. ej. "Deshacer"). */
  usar(aviso: Aviso, accion: ToastAccion): void {
    this.cerrar(aviso.id, true);
    accion.ejecutar();
  }
}

/** Región `aria-live` siempre montada (en `app.ts`) para que el lector de pantalla anuncie cada aviso (H1). */
@Component({
  selector: 'app-toast',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div aria-live="polite" class="print:hidden pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:items-end">
      @for (aviso of toast.avisos(); track aviso.id) {
        <div
          role="status"
          (mouseenter)="toast.pausar(aviso.id)"
          (mouseleave)="toast.reanudar(aviso.id)"
          (focusin)="toast.pausar(aviso.id)"
          (focusout)="toast.reanudar(aviso.id)"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border-l-4 bg-surface p-4 text-sm text-foreground shadow-overlay"
          [class.border-primary]="aviso.tipo === 'info'"
          [class.border-success]="aviso.tipo === 'exito'"
          [class.border-warning]="aviso.tipo === 'advertencia'"
          [class.border-danger]="aviso.tipo === 'error'"
        >
          @if (aviso.tipo === 'advertencia' || aviso.tipo === 'error') {
            <app-icon name="advertencia" [class.text-warning]="aviso.tipo === 'advertencia'" [class.text-danger]="aviso.tipo === 'error'" />
          }
          <div class="flex-1">
            <p>{{ aviso.clave | transloco: aviso.params }}</p>
            @if (aviso.acciones.length) {
              <div class="mt-2 flex flex-wrap gap-2">
                @for (accion of aviso.acciones; track accion.clave) {
                  <button
                    type="button"
                    [attr.data-track]="accion.track ?? null"
                    class="min-h-11 rounded-control border border-border px-3 font-semibold text-primary hover:bg-surface-muted"
                    (click)="toast.usar(aviso, accion)"
                  >{{ accion.clave | transloco }}</button>
                }
              </div>
            }
          </div>
          <button
            type="button"
            class="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted hover:text-foreground"
            [attr.aria-label]="'toast.close' | transloco"
            (click)="toast.cerrar(aviso.id)"
          >
            <app-icon name="cerrar" [size]="18" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Toast {
  protected readonly toast = inject(ToastService);
}
