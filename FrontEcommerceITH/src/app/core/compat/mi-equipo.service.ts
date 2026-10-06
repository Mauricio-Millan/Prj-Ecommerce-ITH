import { Dialog } from '@angular/cdk/dialog';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogApi } from '../catalog/catalog.api';
import { Equipo, Producto } from '../catalog/catalog.models';
import { localStore } from '../storage/local-store';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { EleccionEquipo, MiEquipoSelector } from '../../shared/ui/mi-equipo-selector/mi-equipo-selector';
import { ToastService } from '../../shared/ui/toast/toast';
import { ResultadoCompat, aplica, evaluar, slugDe } from './compat.logic';
import { nombreDeEquipo } from './equipos.logic';

const KEY = 'mi_equipo';

/**
 * "Mi equipo" (spec 003): la laptop del cliente, recordada por navegador (con o sin sesión, CA-1.7).
 * Todo deriva del signal `equipo`: al indicarlo o quitarlo las vistas se actualizan solas, sin recargar ni perder la posición (CA-1.5).
 */
@Injectable({ providedIn: 'root' })
export class MiEquipoService {
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(InteractionLogger);
  private readonly ctx = toSignal(inject(CatalogApi).contextoCompat(), { requireSync: true });

  private readonly equipoId = signal<number | null>(localStore.get<{ equipoId: number }>(KEY)?.equipoId ?? null);

  /** `null` si no hay equipo (o el guardado ya no existe en el catálogo). */
  readonly equipo = computed<Equipo | null>(() => this.ctx().equipos.find((e) => e.id === this.equipoId()) ?? null);
  readonly nombre = computed(() => (this.equipo() ? nombreDeEquipo(this.equipo()!, this.ctx().marcas) : ''));

  /** ¿Tiene sentido hablar de compatibilidad con una laptop para este producto? (spec § 4) */
  aplica(producto: Producto): boolean {
    return aplica(producto, this.ctx().categorias);
  }

  /** `null` si no hay equipo; si el producto no aplica, `estado: 'no_aplica'`. Dentro de un `computed` se actualiza con el equipo. */
  evaluar(producto: Producto): ResultadoCompat | null {
    const equipo = this.equipo();
    return equipo ? evaluar(producto, equipo, this.ctx()) : null;
  }

  /** Subcategoría del producto: "Ver los que sí son compatibles" abre su listado con `compat=1` (CA-3.4). */
  slugSubcategoria(producto: Producto): string {
    return slugDe(producto, this.ctx().categorias);
  }

  indicar(equipoId: number, forma: EleccionEquipo['forma']): void {
    const accion = this.equipoId() === null ? 'indicar' : 'cambiar';
    this.equipoId.set(equipoId);
    localStore.set(KEY, { equipoId });
    this.logger.track('equipo_set', { equipoId, forma, accion });
  }

  quitar(): void {
    const equipoId = this.equipoId();
    if (equipoId === null) return;
    this.equipoId.set(null);
    localStore.remove(KEY);
    this.logger.track('equipo_set', { equipoId, accion: 'quitar' });
  }

  /** Abre el diálogo y, al elegir, guarda y avisa "Listo: mostramos la compatibilidad con tu …" (CA-1.5). */
  abrirSelector(): void {
    const { equipos, marcas } = this.ctx();
    this.dialog
      .open<EleccionEquipo>(MiEquipoSelector, { data: { equipos, marcas }, ariaLabelledBy: 'mi-equipo-titulo' })
      .closed.subscribe((eleccion) => {
        if (!eleccion) return;
        this.indicar(eleccion.equipoId, eleccion.forma);
        this.toast.show('compat.set', 'exito', [], { equipo: this.nombre() });
      });
  }
}
