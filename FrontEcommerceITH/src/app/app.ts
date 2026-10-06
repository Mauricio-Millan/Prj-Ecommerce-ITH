import { ChangeDetectionStrategy, Component, ViewContainerRef, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { localStore } from './core/storage/local-store';
import { Toast } from './shared/ui/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toast />`,
})
export class App {
  constructor() {
    const vcr = inject(ViewContainerRef);
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
