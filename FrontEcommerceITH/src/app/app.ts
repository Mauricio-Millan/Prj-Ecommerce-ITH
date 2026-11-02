import { ChangeDetectionStrategy, Component, ViewContainerRef, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreferenciasA11yService } from './core/a11y/preferencias.service';
import { Analytics } from './core/analytics/analytics';
import { localStore } from './core/storage/local-store';
import { CookieBanner } from './shared/ui/cookie-banner/cookie-banner';
import { Toast } from './shared/ui/toast/toast';
import { VoiceBar } from './shared/ui/voice-bar/voice-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, CookieBanner, VoiceBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toast /><app-cookie-banner /><app-voice-bar />`,
})
export class App {
  constructor() {
    const vcr = inject(ViewContainerRef);
    const analytics = inject(Analytics);
    inject(PreferenciasA11yService); // aplica el tema, el contraste y el tamaño de texto elegidos (spec 018)
    afterNextRender(() => analytics.init());
    // Panel de investigador (spec 012, CA-1.1): sin `?research=1` su código ni siquiera se descarga.
    // También carga si hay una sesión de prueba activa: el router quita el parámetro al navegar y un F5
    // a mitad de la prueba no debe cortar el registro.
    afterNextRender(async () => {
      const activa = localStore.get('research_session') !== null;
      if (!activa && !new URLSearchParams(location.search).has('research')) return;
      const { ResearchPanel } = await import('./core/telemetry/ui/research-panel/research-panel');
      vcr.createComponent(ResearchPanel);
    });
  }
}
