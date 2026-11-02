import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { VoiceService } from '../../../core/voice/voice.service';
import { Icon } from '../icon/icon';

const EJEMPLOS = ['search', 'go', 'cart', 'prefs', 'actions', 'help'] as const;

/**
 * Barra de estado de los comandos de voz (spec 020): aviso de privacidad, "Escuchando…", lo que se entendió, el resultado y la ayuda de voz.
 * Se anuncia con `role="status"`. Solo aparece cuando hay algo que decir; no ocupa espacio el resto del tiempo.
 */
@Component({
  selector: 'app-voice-bar',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section data-modal="voz" data-zone="voz" class="fixed inset-x-3 bottom-3 z-50 mx-auto grid max-w-xl gap-3 rounded-card border border-border-control bg-surface p-4 shadow-overlay print:hidden" [attr.aria-label]="'voice.title' | transloco">
        <div class="flex items-start justify-between gap-2">
          <h2 class="flex items-center gap-2 text-base font-semibold"><app-icon name="microfono" [size]="20" /> {{ 'voice.title' | transloco }}</h2>
          <button type="button" data-track="voz.cerrar" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted" [attr.aria-label]="'common.close' | transloco" (click)="voz.cerrarPanel()">
            <app-icon name="cerrar" />
          </button>
        </div>

        <!-- El resultado se anuncia a los lectores de pantalla (CA-3.2). -->
        <div role="status" aria-live="polite" class="grid gap-1">
          @if (voz.estado() === 'escuchando') {
            <p class="font-semibold">{{ 'voice.listening' | transloco }}</p>
          }
          @if (voz.dicho()) {
            <p class="text-sm text-muted">{{ 'voice.heard' | transloco }}: <span class="font-semibold text-foreground">«{{ voz.dicho() }}»</span></p>
          }
          @if (voz.mensaje(); as m) {
            <p class="flex items-start gap-2 font-semibold">
              <app-icon [name]="m.tipo === 'exito' ? 'compatible' : 'advertencia'" [size]="20" />
              <span>{{ m.clave | transloco: m.params }}</span>
            </p>
          }
        </div>

        @if (voz.avisoPendiente()) {
          <div class="grid gap-2 rounded-control bg-surface-muted p-3 text-sm">
            <p>{{ 'voice.notice' | transloco }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-track="voz.aceptar-aviso" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="voz.aceptarAviso()">{{ 'voice.accept' | transloco }}</button>
              <button type="button" data-track="voz.rechazar-aviso" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface" (click)="voz.rechazarAviso()">{{ 'voice.decline' | transloco }}</button>
            </div>
          </div>
        }

        @if (voz.ayudaVisible()) {
          <div class="grid gap-1 text-sm">
            <h3 class="font-semibold">{{ 'voice.help.title' | transloco }}</h3>
            <ul class="grid gap-1">
              @for (e of ejemplos; track e) {
                <li>{{ 'voice.help.' + e | transloco }}</li>
              }
            </ul>
            <p class="text-muted">{{ 'voice.help.blocked' | transloco }}</p>
          </div>
        } @else if (voz.estado() === 'inactivo' && !voz.avisoPendiente()) {
          <div class="flex flex-wrap gap-2">
            <button type="button" data-track="voz.hablar-otra-vez" class="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="voz.alternar()"><app-icon name="microfono" [size]="18" /> {{ 'voice.again' | transloco }}</button>
            <button type="button" data-track="voz.ayuda" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="voz.ayudaVisible.set(true)">{{ 'voice.help.open' | transloco }}</button>
          </div>
        }
      </section>
    }
  `,
})
export class VoiceBar {
  protected readonly voz = inject(VoiceService);
  protected readonly ejemplos = EJEMPLOS;
  protected readonly visible = computed(() => this.voz.estado() === 'escuchando' || !!this.voz.mensaje() || !!this.voz.dicho() || this.voz.avisoPendiente() || this.voz.ayudaVisible());
}
