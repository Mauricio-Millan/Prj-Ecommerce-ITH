import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '../catalog/catalog.api';
import { ResolucionCodigo, OrigenEscaneo, resolverCodigo } from './scan.logic';

export type ErrorCamara = 'sin_camara' | 'permiso_denegado';

/** Lo que el diálogo le devuelve a quien lo abrió (undefined = cerró sin leer nada). */
export type SalidaEscaner =
  | { accion: 'producto'; sku: string }
  | { accion: 'buscar'; q: string }
  | { accion: 'equipo'; equipoId: number }
  | { accion: 'escribir' };

interface Deteccion {
  rawValue: string;
  format: string;
}
interface DetectorNativo {
  detect(fuente: HTMLVideoElement): Promise<Deteccion[]>;
}

const INTERVALO_MS = 200;

/**
 * Cámara + `BarcodeDetector` (spec 014, plan § 4). Con Chrome en Android la API nativa existe y no pesa nada; sin ella el botón
 * "Escanear" no se muestra (CA-1.1) y quedan la escritura y el lector USB. La biblioteca de respaldo es opcional (T012).
 */
@Injectable({ providedIn: 'root' })
export class ScanService {
  private readonly dialog = inject(Dialog);
  private readonly catalogo = inject(CatalogApi);

  readonly disponible: boolean = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && 'BarcodeDetector' in globalThis;

  /** Abre la cámara en `video` y llama a `alLeer` con cada código nuevo. Devuelve la función que APAGA la cámara (CA-1.3). */
  async iniciar(video: HTMLVideoElement, alLeer: (valor: string, formato: string) => void): Promise<() => void> {
    let flujo: MediaStream;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      throw ((e as DOMException).name === 'NotAllowedError' || (e as DOMException).name === 'SecurityError' ? 'permiso_denegado' : 'sin_camara') satisfies ErrorCamara;
    }
    const Detector = (globalThis as unknown as { BarcodeDetector: new () => DetectorNativo }).BarcodeDetector;
    const detector = new Detector();
    video.srcObject = flujo;
    await video.play().catch(() => undefined);

    let activo = true;
    let ocupado = false;
    const reloj = setInterval(async () => {
      if (!activo || ocupado || video.readyState < 2) return;
      ocupado = true;
      try {
        const [lectura] = await detector.detect(video);
        if (lectura && activo) alLeer(lectura.rawValue, lectura.format);
      } catch {
        /* un cuadro que no se pudo analizar no es un error: se intenta con el siguiente */
      } finally {
        ocupado = false;
      }
    }, INTERVALO_MS);

    return () => {
      activo = false;
      clearInterval(reloj);
      flujo.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }

  /** Resuelve un código contra el catálogo cargado (Fase 1; en la Fase 2 será una llamada a la API). */
  async resolver(texto: string, origen: OrigenEscaneo): Promise<ResolucionCodigo> {
    const [productos, ctx] = await Promise.all([firstValueFrom(this.catalogo.todos()), firstValueFrom(this.catalogo.contextoCompat())]);
    return resolverCodigo(texto, { productos, equipos: ctx.equipos }, origen, globalThis.location?.origin ?? '');
  }

  /** Abre el diálogo y devuelve lo que la persona eligió (o `undefined` si cerró sin leer nada). */
  async abrir(origen: OrigenEscaneo): Promise<SalidaEscaner | undefined> {
    // Carga diferida: el diálogo no pesa en el paquete inicial hasta que alguien escanea.
    const { ScannerDialog } = await import('../../shared/ui/scanner-dialog/scanner-dialog');
    return firstValueFrom(this.dialog.open<SalidaEscaner>(ScannerDialog, { data: { origen }, ariaLabelledBy: 'escaner-titulo' }).closed);
  }
}
