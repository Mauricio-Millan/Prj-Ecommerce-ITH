import { Dialog } from '@angular/cdk/dialog';
import { Location } from '@angular/common';
import { Injector, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MiEquipoService } from '../compat/mi-equipo.service';
import { LanguageService } from '../i18n/language.service';
import { PreferenciasA11yService } from '../a11y/preferencias.service';
import { localStore } from '../storage/local-store';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { A11yPanel } from '../../shared/ui/a11y-panel/a11y-panel';
import { ComandoVoz, interpretarComando } from './voice.logic';

interface ResultadoVoz {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ResultadoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type FabricaReconocedor = new () => Reconocedor;

export type EstadoVoz = 'inactivo' | 'escuchando';
export interface MensajeVoz {
  /** Clave de traducción. */
  clave: string;
  params?: Record<string, string>;
  tipo: 'info' | 'exito' | 'aviso';
}

const KEY_AVISO = 'voz_aviso';
const LENGUA: Record<string, string> = { 'es-PE': 'es-PE', 'en-US': 'en-US', 'qu-PE': 'es-PE' };

const fabrica = (): FabricaReconocedor | null => {
  const g = globalThis as unknown as { SpeechRecognition?: FabricaReconocedor; webkitSpeechRecognition?: FabricaReconocedor };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
};

/**
 * Comandos de voz (spec 020). Un comando por pulsación: `continuous = false`, así el micrófono no queda abierto y la persona decide cuándo habla.
 * Usa el reconocimiento de voz del navegador: en Chrome el audio se procesa en un servicio externo, por eso hay un aviso la primera vez (CA-4.1).
 * No guarda el audio ni lo dicho; la telemetría solo registra el tipo de comando y el resultado (CA-5.2).
 */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly location = inject(Location);
  private readonly prefs = inject(PreferenciasA11yService);
  private readonly injector = inject(Injector); // MiEquipoService arrastra el catálogo: se pide solo cuando se usa
  private readonly logger = inject(InteractionLogger);

  /** El botón del micrófono solo existe si el navegador sabe reconocer voz (CA-1.1). */
  readonly disponible = fabrica() !== null;
  readonly estado = signal<EstadoVoz>('inactivo');
  readonly dicho = signal('');
  readonly mensaje = signal<MensajeVoz | null>(null);
  readonly avisoPendiente = signal(false);
  readonly ayudaVisible = signal(false);

  private reconocedor: Reconocedor | null = null;
  private inicio = 0;
  private huboResultado = false;

  /** Pulsar el micrófono: abre el aviso la primera vez, escucha, o deja de escuchar. */
  alternar(): void {
    if (this.estado() === 'escuchando') return this.detener();
    if (!localStore.get(KEY_AVISO)) {
      this.avisoPendiente.set(true);
      return;
    }
    this.escuchar();
  }

  aceptarAviso(): void {
    localStore.set(KEY_AVISO, true);
    this.avisoPendiente.set(false);
    this.escuchar();
  }

  rechazarAviso(): void {
    this.avisoPendiente.set(false);
  }

  cerrarPanel(): void {
    this.detener();
    this.mensaje.set(null);
    this.dicho.set('');
    this.ayudaVisible.set(false);
    this.avisoPendiente.set(false);
  }

  private escuchar(): void {
    const Fabrica = fabrica();
    if (!Fabrica) return;
    this.mensaje.set(null);
    this.dicho.set('');
    this.huboResultado = false;
    this.inicio = performance.now();
    const r = new Fabrica();
    r.lang = LENGUA[this.injector.get(LanguageService).lang()] ?? 'es-PE';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const ultimo = e.results[e.results.length - 1];
      const texto = ultimo[0].transcript;
      this.dicho.set(texto);
      if (ultimo.isFinal) {
        this.huboResultado = true;
        this.ejecutar(interpretarComando(texto));
      }
    };
    r.onerror = (e) => {
      this.huboResultado = true;
      const denegado = e.error === 'not-allowed' || e.error === 'service-not-allowed';
      this.mensaje.set({ clave: denegado ? 'voice.error.denied' : e.error === 'no-speech' ? 'voice.error.noSpeech' : 'voice.error.generic', tipo: 'aviso' });
      this.registrar('error', 'ninguno');
    };
    r.onend = () => {
      this.estado.set('inactivo');
      this.reconocedor = null;
      if (!this.huboResultado) this.mensaje.set({ clave: 'voice.error.noSpeech', tipo: 'aviso' });
    };
    this.reconocedor = r;
    try {
      r.start();
      this.estado.set('escuchando');
    } catch {
      this.estado.set('inactivo'); // ya estaba escuchando
    }
  }

  private detener(): void {
    this.reconocedor?.stop();
  }

  private ejecutar(c: ComandoVoz): void {
    switch (c.tipo) {
      case 'buscar':
        void this.router.navigate(['/buscar'], { queryParams: { q: c.q } });
        return this.hecho(c.tipo, 'voice.done.search', { q: c.q });
      case 'ir':
        void this.router.navigateByUrl(c.ruta);
        return this.hecho(c.tipo, `voice.done.go.${c.destino}`);
      case 'preferencia':
        this.prefs.elegir(c.clave as never, c.valor as never);
        this.logger.track('a11y_pref_set', { preferencia: c.clave, valor: c.valor, origen: 'voz' });
        return this.hecho(c.tipo, `voice.done.pref.${c.id}`);
      case 'accion':
        return this.accion(c.accion);
      case 'bloqueado':
        this.mensaje.set({ clave: 'voice.blocked', tipo: 'aviso' });
        return this.registrar('bloqueado', c.tipo);
      default:
        this.mensaje.set({ clave: 'voice.unknown', params: { dicho: this.dicho() }, tipo: 'aviso' });
        this.registrar('desconocido', c.tipo);
    }
  }

  private accion(a: Extract<ComandoVoz, { tipo: 'accion' }>['accion']): void {
    const salto = Math.round(window.innerHeight * 0.8);
    switch (a) {
      case 'volver':
        this.location.back();
        break;
      case 'cerrar':
        this.dialog.closeAll();
        this.ayudaVisible.set(false);
        break;
      case 'subir':
        window.scrollBy({ top: -salto, behavior: 'smooth' });
        break;
      case 'bajar':
        window.scrollBy({ top: salto, behavior: 'smooth' });
        break;
      case 'accesibilidad':
        this.dialog.open(A11yPanel, { ariaLabelledBy: 'a11y-titulo' });
        break;
      case 'mi-equipo':
        this.injector.get(MiEquipoService).abrirSelector();
        break;
      case 'ayuda-voz':
        this.ayudaVisible.set(true);
        break;
      case 'agregar': {
        const boton = document.querySelector<HTMLButtonElement>('[data-track="cta-principal.agregar-carrito"]');
        if (!boton || boton.disabled) {
          this.mensaje.set({ clave: 'voice.noAddHere', tipo: 'aviso' });
          return this.registrar('no_aplica', 'accion');
        }
        boton.click();
        break;
      }
    }
    this.hecho('accion', `voice.done.action.${a}`);
  }

  private hecho(tipo: string, clave: string, params?: Record<string, string>): void {
    this.mensaje.set({ clave, params, tipo: 'exito' });
    this.registrar('ok', tipo);
  }

  /** Solo el tipo de comando y el resultado: nunca lo dicho (privacidad, spec 012 CA-2.9). */
  private registrar(resultado: string, comando: string): void {
    this.logger.track('voice_command', { resultado, comando, ms: Math.round(performance.now() - this.inicio) });
  }

}
