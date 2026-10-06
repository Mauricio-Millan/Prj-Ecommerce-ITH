import { DOCUMENT, Injectable, OnDestroy, inject, isDevMode, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { localStore } from '../storage/local-store';
import { Evento, TareaId, TipoEvento } from './telemetry.models';
import { esModalCatalogado, esZonaCatalogada } from './zone-catalog';

const FLUSH_MS = 2000;
const MOUSE_MS = 100;
const SCROLL_MS = 250;
const CAPACIDAD_BYTES = 5 * 1024 * 1024; // ~5 MB de localStorage
const INTERACTIVO = 'a,button,input,select,textarea,label,summary,[role=button],[role=menuitem],[role=menuitemradio],[tabindex]:not([tabindex="-1"])';
const PANEL = '[data-research-panel]';

export const claveEventos = (sesionId: string) => `research_events_${sesionId}`;

/** Patrón de ruta: une los `routeConfig.path` hasta la hoja ("/producto/:id") (CA-2.13). */
export function patronDeRuta(root: ActivatedRouteSnapshot): string {
  const partes: string[] = [];
  for (let n: ActivatedRouteSnapshot | null = root; n; n = n.firstChild) {
    if (n.routeConfig?.path) partes.push(n.routeConfig.path);
  }
  return '/' + partes.join('/');
}

type Contexto = Pick<Evento, 'x' | 'y' | 'f' | 'z' | 'zi' | 'zx' | 'zy' | 'm'>;

/**
 * Registra la interacción FUERA del ciclo de render (app zoneless):
 * - listeners nativos en `document` (no disparan detección de cambios);
 * - ningún signal se escribe en los handlers de alta frecuencia; `stats` se actualiza solo en el flush (cada 2 s);
 * - el buffer se guarda en bloque, nunca un `localStorage.setItem` por evento.
 */
@Injectable({ providedIn: 'root' })
export class InteractionLogger implements OnDestroy {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private sesion: { id: string; version: string } | null = null;
  /** Tarea en curso: la fija `SessionRecorder`. */
  tarea: TareaId | null = null;

  private guardados: Evento[] = [];
  private buffer: Evento[] = [];
  private bytes = 0;
  private mouseActivo = true;
  readonly stats = signal({ eventos: 0, porcentaje: 0, lleno: false });

  private ruta = '';
  private patron = '/';
  private zonaActual: Element | null = null;
  private ultimoMouse: { target: Element; cx: number; cy: number; px: number; py: number } | null = null;
  private mouseCambio = false;
  private scrollMax = 0;
  private scrollCambio = false;

  private readonly fijoCache = new WeakMap<Element, boolean>();
  private readonly avisados = new Set<string>();
  private limpiezas: (() => void)[] = [];
  private routerSub?: Subscription;

  get activo(): boolean {
    return this.sesion !== null;
  }

  /** Todos los eventos de la sesión: los ya guardados más los pendientes de guardar. */
  eventos(): Evento[] {
    return this.guardados.concat(this.buffer);
  }

  start(sesionId: string, version: string): void {
    if (this.sesion) return;
    this.sesion = { id: sesionId, version };
    this.guardados = localStore.get<Evento[]>(claveEventos(sesionId)) ?? []; // al retomar una sesión se sigue agregando
    this.bytes = JSON.stringify(this.guardados).length * 2;
    this.mouseActivo = true;
    this.actualizarRuta();
    this.escuchar();
    this.track('page_enter', { viewport: this.viewport() });
    this.actualizarStats(false);
  }

  stop(): void {
    if (!this.sesion) return;
    this.flush();
    this.limpiezas.forEach((fn) => fn());
    this.limpiezas = [];
    this.routerSub?.unsubscribe();
    this.sesion = null;
    this.tarea = null;
    this.zonaActual = null;
    this.ultimoMouse = null;
  }

  /** Borra los eventos guardados de la sesión (CA-3.4). */
  borrar(sesionId: string): void {
    localStore.remove(claveEventos(sesionId));
    if (this.sesion?.id === sesionId) {
      this.guardados = [];
      this.buffer = [];
      this.bytes = 0;
      this.actualizarStats(false);
    }
  }

  /** API pública para las páginas (búsqueda, carrito, errores de formulario…). Sin sesión no hace nada (CA-2.8). */
  track(e: TipoEvento, d?: Record<string, unknown>, extra?: Partial<Evento>): void {
    if (!this.sesion) return;
    const evento: Evento = {
      s: this.sesion.id,
      t: Math.round(performance.timeOrigin + performance.now()),
      e,
      v: this.sesion.version,
      r: this.ruta,
      p: this.patron,
      ...extra,
    };
    if (this.tarea) evento.k = this.tarea;
    if (d) evento.d = d;
    this.buffer.push(evento);
  }

  flush(): void {
    if (!this.sesion || this.buffer.length === 0) return;
    let pendientes = this.buffer;
    let todos = this.guardados.concat(pendientes);
    let ok = localStore.set(claveEventos(this.sesion.id), todos);
    if (!ok && this.mouseActivo) {
      // Almacenamiento lleno: se deja de muestrear el mouse y se reintenta sin esos puntos (CA-3.5).
      this.mouseActivo = false;
      pendientes = pendientes.filter((ev) => ev.e !== 'mouse_move');
      todos = this.guardados.concat(pendientes);
      ok = localStore.set(claveEventos(this.sesion.id), todos);
    }
    if (ok) {
      this.bytes += JSON.stringify(pendientes).length * 2;
      this.guardados = todos;
      this.buffer = [];
    } else {
      // Sigue en memoria (eventos() lo incluye al exportar) y se reintenta en el próximo flush.
      this.buffer = pendientes;
    }
    this.actualizarStats(!ok);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  // ───────────── listeners ─────────────

  private escuchar(): void {
    const doc = this.document;
    const win = doc.defaultView!;
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const on = <K extends keyof DocumentEventMap>(tipo: K, fn: (ev: DocumentEventMap[K]) => void) => {
      doc.addEventListener(tipo, fn, opts);
      this.limpiezas.push(() => doc.removeEventListener(tipo, fn, opts));
    };
    const cada = (ms: number, fn: () => void) => {
      const id = win.setInterval(fn, ms);
      this.limpiezas.push(() => win.clearInterval(id));
    };

    on('click', (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target || target.closest(PANEL)) return; // CA-1.7
      const tr = target.closest('[data-track]')?.getAttribute('data-track') ?? undefined;
      const interactivo = !!target.closest(INTERACTIVO);
      // detail = 0: activado con teclado (Enter/Espacio). No tiene posición real: se registra sin coordenadas.
      if (ev.detail === 0) {
        const z = target.closest('[data-zone]')?.getAttribute('data-zone') ?? undefined;
        this.track('click', { interactivo, teclado: true }, { ...(z && { z }), ...(tr && { tr }) });
        return;
      }
      const ctx = this.contexto(target, ev.clientX, ev.clientY, ev.pageX, ev.pageY, true);
      this.track('click', { interactivo }, tr ? { ...ctx, tr } : ctx);
    });

    // Solo se guarda el último punto; el muestreo calcula el contexto (CA-2.2).
    on('mousemove', (ev) => {
      if (!(ev.target instanceof Element)) return;
      this.ultimoMouse = { target: ev.target, cx: ev.clientX, cy: ev.clientY, px: ev.pageX, py: ev.pageY };
      this.mouseCambio = true;
    });
    cada(MOUSE_MS, () => {
      if (!this.mouseCambio || !this.mouseActivo || !this.ultimoMouse) return;
      this.mouseCambio = false;
      const { target, cx, cy, px, py } = this.ultimoMouse;
      if (target.closest(PANEL)) return;
      this.track('mouse_move', undefined, this.contexto(target, cx, cy, px, py, false));
    });

    // Delegación: mouseenter no burbujea (CA-2.3).
    on('mouseover', (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const zona = target && !target.closest(PANEL) ? target.closest('[data-zone]') : null;
      this.cambiarZona(zona);
    });
    on('mouseout', (ev) => {
      if (ev.relatedTarget === null) this.cambiarZona(null); // el puntero salió de la ventana
    });

    on('scroll', () => {
      const el = doc.documentElement;
      const profundidad = Math.min(100, Math.round(((win.scrollY + win.innerHeight) / el.scrollHeight) * 100));
      if (profundidad > this.scrollMax) {
        this.scrollMax = profundidad;
        this.scrollCambio = true;
      }
    });
    cada(SCROLL_MS, () => {
      if (!this.scrollCambio) return;
      this.scrollCambio = false;
      this.track('scroll', { profundidad: this.scrollMax });
    });

    on('visibilitychange', () => {
      this.track('visibility', { estado: doc.visibilityState });
      if (doc.visibilityState === 'hidden') this.flush();
    });

    const alSalir = () => this.flush();
    win.addEventListener('pagehide', alSalir);
    this.limpiezas.push(() => win.removeEventListener('pagehide', alSalir));
    cada(FLUSH_MS, () => this.flush());

    this.routerSub = this.router.events.subscribe((ev) => {
      // El botón "Atrás" del navegador es una señal de golfo de evaluación (R2 § 3.3).
      if (ev instanceof NavigationStart && ev.navigationTrigger === 'popstate') this.track('back_navigation', { origen: 'navegador' });
      if (ev instanceof NavigationEnd) {
        this.cambiarZona(null);
        this.track('page_leave');
        this.actualizarRuta();
        this.track('page_enter', { viewport: this.viewport() });
      }
    });
  }

  private cambiarZona(zona: Element | null): void {
    if (zona === this.zonaActual) return;
    const anterior = this.zonaActual?.getAttribute('data-zone');
    if (anterior) this.track('zone_leave', undefined, { z: anterior });
    this.zonaActual = zona;
    const nueva = zona?.getAttribute('data-zone');
    if (nueva) {
      this.avisarSiNoCatalogado(nueva, 'zona');
      this.track('zone_enter', undefined, { z: nueva });
    }
  }

  private actualizarRuta(): void {
    this.ruta = this.router.url.split(/[?#]/)[0];
    this.patron = patronDeRuta(this.router.routerState.snapshot.root);
    this.scrollMax = 0;
  }

  private viewport() {
    const win = this.document.defaultView!;
    return { w: win.innerWidth, h: win.innerHeight };
  }

  /** Contexto espacial de un punto (plan § 3.1.1, CA-2.10–2.12). Solo se llama al registrar, nunca por cada mousemove. */
  contexto(target: Element, cx: number, cy: number, px: number, py: number, esClic: boolean): Contexto {
    const ctx: Contexto = {};
    if (this.esFijo(target)) {
      ctx.f = 1;
      ctx.x = Math.round(cx);
      ctx.y = Math.round(cy);
    } else {
      ctx.x = Math.round(px);
      ctx.y = Math.round(py);
    }

    const zona = target.closest('[data-zone]');
    const z = zona?.getAttribute('data-zone');
    if (zona && z) {
      const rect = zona.getBoundingClientRect();
      ctx.z = z;
      if (rect.width > 0 && rect.height > 0) {
        ctx.zx = Math.round(((cx - rect.left) / rect.width) * 1000) / 1000;
        ctx.zy = Math.round(((cy - rect.top) / rect.height) * 1000) / 1000;
      }
      if (esClic) {
        const mismas = this.document.querySelectorAll(`[data-zone="${z}"]`);
        if (mismas.length > 1) ctx.zi = Array.prototype.indexOf.call(mismas, zona);
      }
    }

    const m = this.document.querySelector('[data-modal]')?.getAttribute('data-modal');
    if (m) {
      ctx.m = m;
      this.avisarSiNoCatalogado(m, 'modal');
    }
    return ctx;
  }

  // ponytail: la caché no se invalida si un elemento cambia de `position` en vivo; basta para layouts estáticos.
  private esFijo(el: Element): boolean {
    const enCache = this.fijoCache.get(el);
    if (enCache !== undefined) return enCache;
    const position = this.document.defaultView!.getComputedStyle(el).position;
    const fijo = position === 'fixed' || position === 'sticky' || (el.parentElement ? this.esFijo(el.parentElement) : false);
    this.fijoCache.set(el, fijo);
    return fijo;
  }

  /** CA-4.2 / CA-4.4: avisa una sola vez por nombre fuera del catálogo, solo en desarrollo. */
  private avisarSiNoCatalogado(nombre: string, tipo: 'zona' | 'modal'): void {
    if (!isDevMode() || this.avisados.has(tipo + nombre)) return;
    const ok = tipo === 'zona' ? esZonaCatalogada(nombre) : esModalCatalogado(nombre);
    if (ok) return;
    this.avisados.add(tipo + nombre);
    console.warn(`[telemetría] ${tipo} no catalogada: "${nombre}". Agrégala primero a la spec 012 § 4.`);
  }

  private actualizarStats(lleno: boolean): void {
    this.stats.set({
      eventos: this.guardados.length + this.buffer.length,
      porcentaje: Math.min(100, Math.round((this.bytes / CAPACIDAD_BYTES) * 100)),
      lleno: lleno || !this.mouseActivo,
    });
  }
}
