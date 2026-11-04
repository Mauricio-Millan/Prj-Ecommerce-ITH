import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Equipo, Producto } from '../../../core/catalog/catalog.models';
import { OrigenEscaneo } from '../../../core/scan/scan.logic';
import { SalidaEscaner, ScanService } from '../../../core/scan/scan.service';
import { localStore } from '../../../core/storage/local-store';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { Icon } from '../icon/icon';

type Estado = 'intro' | 'buscando' | 'leido' | 'elegir' | 'ninguno' | 'externo' | 'manual' | 'sin_camara' | 'permiso_denegado';
type Resultado = 'producto' | 'varios' | 'equipo' | 'sin_coincidencia' | 'cancelado' | 'sin_camara' | 'permiso_denegado';

interface Opcion {
  clave: string | number;
  etiqueta: string;
  salida: SalidaEscaner;
}

const KEY_INTRO = 'scan_intro';
const CIERRE_TRAS_LEER_MS = 700;

/**
 * Diálogo de escaneo (spec 014). Primero móvil: a pantalla completa en pantallas pequeñas. Estados con ícono y texto, nunca solo color (CA-4.4).
 * La cámara se apaga al leer, al escribir y al cerrar (CA-1.3). Raíz con `data-modal="escaner"`.
 */
@Component({
  selector: 'app-scanner-dialog',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div data-modal="escaner" data-zone="escaner" class="flex h-dvh w-screen flex-col bg-surface shadow-overlay sm:h-auto sm:max-h-[90vh] sm:w-[min(34rem,92vw)] sm:rounded-card">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="escaner-titulo" class="text-lg font-semibold">{{ 'scan.title' | transloco }}</h2>
        <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'scan.close' | transloco" (click)="cerrar()">
          <app-icon name="cerrar" />
        </button>
      </div>

      <div class="grid flex-1 content-start gap-4 overflow-y-auto p-4">
        <!-- Cámara: el elemento existe siempre para poder arrancar y apagar el flujo sin recrearlo. -->
        <div [class.hidden]="estado() !== 'buscando'" class="relative overflow-hidden rounded-card bg-black">
          <video #video playsinline muted class="aspect-[3/4] w-full object-cover sm:aspect-video" [attr.aria-label]="'scan.videoLabel' | transloco"></video>
          <div class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
            <div class="h-1/3 w-4/5 rounded-card border-4 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"></div>
          </div>
        </div>

        @switch (estado()) {
          @case ('intro') {
            <div class="grid gap-3">
              <p class="text-base">{{ 'scan.intro' | transloco }}</p>
              <button type="button" data-track="escaner.continuar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="continuar()">{{ 'scan.continue' | transloco }}</button>
              <button type="button" data-track="escaner.escribir-codigo" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="irAManual()">{{ 'scan.typeCode' | transloco }}</button>
            </div>
          }
          @case ('buscando') {
            <p class="flex items-center gap-2 text-sm font-medium"><app-icon name="escanear" [size]="20" /> {{ 'scan.instruction' | transloco }}</p>
            <button type="button" data-track="escaner.escribir-codigo" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="irAManual()">{{ 'scan.typeCode' | transloco }}</button>
          }
          @case ('leido') {
            <p class="flex items-center gap-2 rounded-card bg-surface-muted p-3 font-semibold text-success"><app-icon name="compatible" [size]="22" /> {{ 'scan.read' | transloco }}</p>
          }
          @case ('elegir') {
            <div class="grid gap-2">
              <p class="font-semibold">{{ (origen === 'mi-equipo' ? 'scan.chooseEquipo' : 'scan.chooseProduct') | transloco }}</p>
              <ul class="grid gap-1">
                @for (o of opciones(); track o.clave) {
                  <li><button type="button" data-track="escaner.elegir" class="min-h-11 w-full rounded-control border border-border px-3 text-left text-sm hover:bg-surface-muted" (click)="cerrarCon(o.salida)">{{ o.etiqueta }}</button></li>
                }
              </ul>
            </div>
          }
          @case ('ninguno') {
            <div class="grid gap-3">
              <p class="flex items-center gap-2 font-semibold"><app-icon name="advertencia" [size]="22" /> {{ (origen === 'mi-equipo' ? 'scan.serialOnly' : 'scan.unknown') | transloco }}</p>
              @if (origen === 'mi-equipo') {
                <p class="text-sm text-muted">{{ 'scan.serialHelp' | transloco }}</p>
              }
              <p class="break-all rounded-control bg-surface-muted p-2 text-xs"><span class="font-semibold">{{ 'scan.readContent' | transloco }}:</span> {{ codigo() }}</p>
              @if (origen === 'buscador') {
                <button type="button" data-track="escaner.buscar-como-texto" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="cerrarCon({ accion: 'buscar', q: codigo() })">{{ 'scan.searchAsText' | transloco }}</button>
              }
              <button type="button" data-track="escaner.escanear-otro" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="arrancar()">{{ 'scan.scanAnother' | transloco }}</button>
              <button type="button" data-track="escaner.escribir-codigo" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="origen === 'mi-equipo' ? cerrarCon({ accion: 'escribir' }) : irAManual()">{{ (origen === 'mi-equipo' ? 'scan.chooseBySteps' : 'scan.typeCode') | transloco }}</button>
            </div>
          }
          @case ('externo') {
            <div class="grid gap-3">
              @if (modelo(); as m) {
                <!-- La dirección nombra una laptop que todavía no está en el catálogo: se dice cuál, en vez de "lleva a otro sitio". -->
                <p class="flex items-center gap-2 font-semibold"><app-icon name="advertencia" [size]="22" /> {{ 'scan.modelNotListed' | transloco: { modelo: m } }}</p>
                <p class="text-sm text-muted">{{ 'scan.modelNotListedHelp' | transloco }}</p>
                @if (origen === 'buscador') {
                  <button type="button" data-track="escaner.buscar-modelo" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="cerrarCon({ accion: 'buscar', q: m })">{{ 'scan.searchModel' | transloco: { modelo: m } }}</button>
                } @else {
                  <button type="button" data-track="escaner.escribir-codigo" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="cerrarCon({ accion: 'escribir' })">{{ 'scan.chooseBySteps' | transloco }}</button>
                }
              } @else {
                <p class="flex items-center gap-2 font-semibold"><app-icon name="advertencia" [size]="22" /> {{ 'scan.external' | transloco }}</p>
                <p class="text-sm text-muted">{{ 'scan.externalHelp' | transloco }}</p>
                <p class="break-all rounded-control bg-surface-muted p-2 text-xs">{{ codigo() }}</p>
                <button type="button" data-track="escaner.copiar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="copiar()">{{ (copiado() ? 'scan.copied' : 'scan.copy') | transloco }}</button>
              }
              <button type="button" data-track="escaner.escanear-otro" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="arrancar()">{{ 'scan.scanAnother' | transloco }}</button>
            </div>
          }
          @case ('manual') {
            <form class="grid gap-2" (submit)="enviarManual($event)">
              <label for="escaner-manual" class="text-sm font-semibold">{{ 'scan.manual.label' | transloco }}</label>
              <input id="escaner-manual" #manual type="text" autocomplete="off" autocapitalize="characters" class="min-h-11 w-full rounded-control border border-border-control bg-surface px-3 text-sm placeholder:text-muted" [placeholder]="'scan.manual.placeholder' | transloco" />
              <button type="submit" data-track="escaner.buscar-manual" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'scan.manual.submit' | transloco }}</button>
              @if (camaraDisponible) {
                <button type="button" data-track="escaner.escanear-otro" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="arrancar()">{{ 'scan.useCamera' | transloco }}</button>
              }
            </form>
          }
          @case ('sin_camara') {
            <div class="grid gap-3">
              <p class="flex items-center gap-2 font-semibold"><app-icon name="advertencia" [size]="22" /> {{ 'scan.noCamera' | transloco }}</p>
              <button type="button" data-track="escaner.escribir-codigo" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="irAManual()">{{ 'scan.typeCode' | transloco }}</button>
            </div>
          }
          @case ('permiso_denegado') {
            <div class="grid gap-3">
              <p class="flex items-center gap-2 font-semibold"><app-icon name="advertencia" [size]="22" /> {{ 'scan.noCamera' | transloco }}</p>
              <button type="button" data-track="escaner.escribir-codigo" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="irAManual()">{{ 'scan.typeCode' | transloco }}</button>
            </div>
          }
        }

        <!-- Anuncia el resultado a los lectores de pantalla (CA-4.3). -->
        <p class="sr-only" role="status" aria-live="polite">
          @if (anuncio(); as a) {
            {{ a.clave | transloco: a.params }}
          }
        </p>
      </div>
    </div>
  `,
})
export class ScannerDialog implements OnDestroy {
  protected readonly ref = inject<DialogRef<SalidaEscaner>>(DialogRef);
  protected readonly origen: OrigenEscaneo = inject<{ origen: OrigenEscaneo }>(DIALOG_DATA).origen;
  private readonly scan = inject(ScanService);
  private readonly logger = inject(InteractionLogger);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly manual = viewChild<ElementRef<HTMLInputElement>>('manual');

  protected readonly camaraDisponible = this.scan.disponible;
  protected readonly estado = signal<Estado>('intro');
  protected readonly codigo = signal('');
  protected readonly modelo = signal<string | null>(null);
  protected readonly opciones = signal<Opcion[]>([]);
  protected readonly copiado = signal(false);
  protected readonly anuncio = signal<{ clave: string; params?: Record<string, string> } | null>(null);

  private apagar: (() => void) | null = null;
  private inicio = 0;
  private resultadoEmitido = false;
  private fuente: 'camara' | 'manual' = 'camara';

  constructor() {
    this.ref.closed.subscribe(() => this.apagarCamara());
    if (!this.camaraDisponible) {
      this.estado.set('sin_camara');
      this.registrar('sin_camara');
    } else if (localStore.get(KEY_INTRO)) {
      queueMicrotask(() => void this.arrancar());
    }
  }

  ngOnDestroy(): void {
    this.apagarCamara();
    if (this.inicio) this.registrar('cancelado');
  }

  protected continuar(): void {
    localStore.set(KEY_INTRO, true);
    void this.arrancar();
  }

  protected async arrancar(): Promise<void> {
    this.apagarCamara();
    this.resultadoEmitido = false;
    this.fuente = 'camara';
    this.estado.set('buscando');
    this.anuncio.set(null);
    this.inicio = performance.now();
    this.logger.track('scan_start', { origen: this.origen, fuente: 'camara' });
    try {
      this.apagar = await this.scan.iniciar(this.video()!.nativeElement, (valor, formato) => void this.alLeer(valor, formato));
    } catch (e) {
      const motivo = e === 'permiso_denegado' ? 'permiso_denegado' : 'sin_camara';
      this.estado.set(motivo);
      this.registrar(motivo);
    }
  }

  protected irAManual(): void {
    this.apagarCamara();
    this.estado.set('manual');
    queueMicrotask(() => this.manual()?.nativeElement.focus());
  }

  protected enviarManual(e: Event): void {
    e.preventDefault();
    const valor = this.manual()?.nativeElement.value.trim() ?? '';
    if (!valor) return;
    this.fuente = 'manual';
    this.resultadoEmitido = false;
    this.inicio = performance.now();
    void this.alLeer(valor, 'manual');
  }

  private async alLeer(valor: string, formato: string): Promise<void> {
    this.apagarCamara(); // un código a la vez: se apaga la cámara apenas hay una lectura
    this.codigo.set(valor);
    if (navigator.vibrate) navigator.vibrate(60);
    const r = await this.scan.resolver(valor, this.origen);
    const ms = Math.round(performance.now() - this.inicio);
    switch (r.tipo) {
      case 'producto':
        return this.leido({ accion: 'producto', sku: r.producto.sku }, 'scan.announce.product', { nombre: r.producto.nombre }, 'producto', formato, ms);
      case 'varios':
        this.registrar('varios', formato, ms);
        if (this.origen === 'buscador') return this.cerrarCon({ accion: 'buscar', q: valor });
        return this.elegir(
          r.productos.map((p: Producto) => ({ clave: p.sku, etiqueta: p.nombre, salida: { accion: 'producto' as const, sku: p.sku } })),
          'scan.announce.several',
        );
      case 'equipo': {
        if (r.equipos.length === 1) return this.leido({ accion: 'equipo', equipoId: r.equipos[0].id }, 'scan.announce.equipo', { nombre: r.equipos[0].modelo }, 'equipo', formato, ms);
        this.registrar('equipo', formato, ms);
        return this.elegir(
          r.equipos.map((q: Equipo) => ({ clave: q.id, etiqueta: q.modelo, salida: { accion: 'equipo' as const, equipoId: q.id } })),
          'scan.announce.several',
        );
      }
      case 'externo':
        this.registrar('sin_coincidencia', formato, ms);
        this.modelo.set(r.modelo ?? null);
        this.estado.set('externo');
        this.anuncio.set(r.modelo ? { clave: 'scan.modelNotListed', params: { modelo: r.modelo } } : { clave: 'scan.external' });
        return;
      default:
        this.registrar('sin_coincidencia', formato, ms);
        this.estado.set('ninguno');
        this.anuncio.set({ clave: this.origen === 'mi-equipo' ? 'scan.serialOnly' : 'scan.unknown' });
    }
  }

  private leido(salida: SalidaEscaner, clave: string, params: Record<string, string>, resultado: Resultado, formato: string, ms: number): void {
    this.registrar(resultado, formato, ms);
    this.estado.set('leido');
    this.anuncio.set({ clave, params });
    setTimeout(() => this.cerrarCon(salida), CIERRE_TRAS_LEER_MS);
  }

  private elegir(opciones: Opcion[], anuncio: string): void {
    this.opciones.set(opciones);
    this.estado.set('elegir');
    this.anuncio.set({ clave: anuncio });
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codigo());
      this.copiado.set(true);
    } catch {
      /* sin permiso para el portapapeles: el texto sigue visible para copiarlo a mano */
    }
  }

  protected cerrarCon(salida: SalidaEscaner): void {
    this.ref.close(salida);
  }

  protected cerrar(): void {
    this.ref.close();
  }

  private apagarCamara(): void {
    this.apagar?.();
    this.apagar = null;
  }

  /** Una sola vez por lectura (CA-5.2). Nunca guarda el contenido del código ni imágenes (CA-5.3). */
  private registrar(resultado: Resultado, formato = 'ninguno', ms = 0): void {
    if (this.resultadoEmitido) return;
    this.resultadoEmitido = true;
    this.logger.track('scan_result', { origen: this.origen, fuente: this.fuente, resultado, formato, ms: ms || Math.round(performance.now() - this.inicio) });
  }
}
