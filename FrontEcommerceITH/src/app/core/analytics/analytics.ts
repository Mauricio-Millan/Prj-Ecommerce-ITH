import { DOCUMENT, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { GTM_ID } from '../config/analytics';
import { localStore } from '../storage/local-store';

export type DecisionCookies = 'aceptado' | 'rechazado';

/** ID del contenedor de Google Tag Manager; se puede reemplazar en las pruebas. */
export const GTM_ID_TOKEN = new InjectionToken<string>('GTM_ID', { factory: () => GTM_ID });

const CLAVE = 'consent_analytics';

/**
 * Parámetros que se envían a Google por evento. Lista cerrada: nunca texto libre del usuario
 * (por eso la consulta de búsqueda `q` no sale del navegador) ni datos personales.
 */
const PERMITIDOS: Record<string, readonly string[]> = {
  search: ['resultados', 'exacta', 'interpretada'],
  filter: ['atributo', 'accion', 'resultados'],
  equipo_set: ['accion', 'forma'],
  compat_warning: ['decision'],
  add_to_cart: ['sku', 'origen', 'cantidad', 'compatible'],
  remove_from_cart: ['sku', 'cantidad'],
  undo: ['accion'],
  auth_result: ['accion', 'resultado'],
  form_error: ['campo', 'codigo'],
  checkout_step: ['paso', 'accion'],
  payment_method: ['metodo'],
  payment_result: ['metodo', 'resultado', 'intento'],
  builder_conflict: ['causa'],
  builder_complete: [],
  reorder: [],
};

type Parametros = Record<string, string | number | boolean>;
type VentanaGtm = Window & { dataLayer?: Record<string, unknown>[] };

/**
 * Google Tag Manager con consentimiento previo. Hasta que el visitante acepta no se descarga nada de Google.
 * La app solo empuja eventos a `dataLayer`; qué se envía a GA4 lo decide el contenedor (spec 013).
 * Se apaga en las sesiones de investigación (`?research=1`): esas se miden con el logger propio (spec 012).
 */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly gtmId = inject(GTM_ID_TOKEN);

  /** Hay un contenedor configurado. */
  readonly disponible = this.gtmId !== '';
  readonly decision = signal<DecisionCookies | null>(localStore.get<DecisionCookies>(CLAVE));

  private readonly listo = signal(false);
  private readonly investigacion = signal(false);
  private readonly reabierto = signal(false);
  private cargado = false;
  private ultimaRuta = '';

  /** El aviso de cookies se muestra si falta decidir, o si el visitante pidió cambiar su decisión. */
  readonly mostrarAviso = computed(
    () => this.disponible && this.listo() && !this.investigacion() && (this.decision() === null || this.reabierto()),
  );

  /** Solo en el navegador (el servidor no tiene `window`). */
  init(): void {
    if (!this.disponible || this.listo()) return;
    const win = this.doc.defaultView;
    if (!win) return;
    if (new URLSearchParams(win.location.search).has('research') || localStore.get('research_session') !== null) this.investigacion.set(true);
    this.listo.set(true);
    this.router.events.subscribe((ev) => {
      // Con un pequeño retraso: las fichas ponen su título cuando llegan los datos, y GA lo lee al enviar.
      if (ev instanceof NavigationEnd) setTimeout(() => this.paginaVista(), 300);
    });
    if (this.decision() === 'aceptado') this.activar();
  }

  responder(decision: DecisionCookies): void {
    const habiaCargado = this.cargado;
    localStore.set(CLAVE, decision);
    this.decision.set(decision);
    this.reabierto.set(false);
    if (decision === 'aceptado') this.activar();
    else this.desactivar(habiaCargado);
  }

  /** Enlace "Preferencias de cookies" del pie. */
  reabrir(): void {
    this.reabierto.set(true);
  }

  /** Reenvía un evento de negocio del logger. Solo los de la lista y solo sus parámetros permitidos. */
  evento(tipo: string, d?: Record<string, unknown>): void {
    const permitidos = PERMITIDOS[tipo];
    if (!permitidos || !this.puedeEnviar()) return;
    const params: Parametros = {};
    for (const clave of permitidos) {
      const v = d?.[clave];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') params[clave] = v;
    }
    this.empujar(tipo, params);
  }

  private puedeEnviar(): boolean {
    return this.cargado && this.decision() === 'aceptado' && !this.investigacion() && localStore.get('research_session') === null;
  }

  private paginaVista(): void {
    if (!this.puedeEnviar()) return;
    const ruta = this.rutaLimpia();
    if (ruta === this.ultimaRuta) return;
    this.ultimaRuta = ruta;
    const win = this.doc.defaultView!;
    this.empujar('page_view', { page_path: ruta, page_location: win.location.origin + ruta, page_title: this.doc.title });
  }

  /** Sin parámetros de URL (pueden llevar texto buscado) y sin códigos de pedido. */
  private rutaLimpia(): string {
    return this.router.url
      .split(/[?#]/)[0]
      .replace(/^\/pedido\/[^/]+/, '/pedido/:codigo')
      .replace(/^\/cuenta\/pedidos\/[^/]+/, '/cuenta/pedidos/:codigo');
  }

  private activar(): void {
    const win = this.doc.defaultView as VentanaGtm | null;
    if (!win || !this.disponible || this.investigacion()) return;
    if (!this.cargado) {
      // Mismo arranque que el fragmento oficial de Google, pero solo tras el consentimiento.
      win.dataLayer = win.dataLayer ?? [];
      win.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const script = this.doc.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${this.gtmId}`;
      this.doc.head.appendChild(script);
      this.cargado = true;
    }
    this.ultimaRuta = '';
    this.paginaVista();
  }

  /** Un contenedor ya cargado no se puede descargar: si se retira el consentimiento, se recarga la página sin él. */
  private desactivar(habiaCargado: boolean): void {
    const win = this.doc.defaultView;
    if (!win) return;
    for (const cookie of this.doc.cookie.split(';')) {
      const nombre = cookie.split('=')[0].trim();
      if (!nombre.startsWith('_ga')) continue;
      const host = win.location.hostname;
      for (const dominio of ['', `;domain=${host}`, `;domain=.${host}`]) {
        this.doc.cookie = `${nombre}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${dominio}`;
      }
    }
    if (habiaCargado) win.location.reload();
  }

  private empujar(evento: string, params: Parametros): void {
    (this.doc.defaultView as VentanaGtm | null)?.dataLayer?.push({ event: evento, ...params });
  }
}
