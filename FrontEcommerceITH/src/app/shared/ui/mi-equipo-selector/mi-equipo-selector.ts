import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Equipo, Marca } from '../../../core/catalog/catalog.models';
import { buscarEquipos, equiposDe, marcasConEquipos } from '../../../core/compat/equipos.logic';
import { Icon } from '../icon/icon';

export interface DatosSelector {
  equipos: readonly Equipo[];
  marcas: readonly Marca[];
}

export interface EleccionEquipo {
  equipoId: number;
  forma: 'pasos' | 'busqueda';
}

/**
 * Diálogo para indicar la laptop (spec 003, HU-1): escribiendo el modelo o el código, o por pasos (marca → modelo).
 * Elegir un modelo confirma: no hay un botón extra (menos clics, H7). Raíz con `data-modal="mi-equipo"`.
 */
@Component({
  selector: 'app-mi-equipo-selector',
  imports: [TranslocoPipe, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div data-modal="mi-equipo" class="flex max-h-[90vh] w-[min(34rem,92vw)] flex-col rounded-card bg-surface shadow-overlay">
      <div class="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="mi-equipo-titulo" class="text-lg font-semibold">{{ 'compat.selector.title' | transloco }}</h2>
        <button
          type="button"
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted"
          [attr.aria-label]="'compat.selector.close' | transloco"
          (click)="ref.close()"
        ><app-icon name="cerrar" /></button>
      </div>

      <div class="grid gap-6 overflow-y-auto p-4">
        <!-- Forma 1: escribir el modelo o el código (combobox accesible, igual que el buscador). -->
        <section class="grid gap-2">
          <label for="mi-equipo-buscar" class="text-sm font-semibold">{{ 'compat.selector.type' | transloco }}</label>
          <input
            id="mi-equipo-buscar"
            type="search"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            class="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm placeholder:text-muted"
            [placeholder]="'compat.selector.placeholder' | transloco"
            [attr.aria-expanded]="hayLista()"
            [attr.aria-controls]="hayLista() ? 'mi-equipo-lista' : null"
            [attr.aria-activedescendant]="hayLista() && activa() >= 0 ? 'mi-equipo-opcion-' + activa() : null"
            [value]="texto()"
            (input)="escribir($any($event.target).value)"
            (keydown)="teclear($event)"
          />
          @if (hayLista()) {
            <ul id="mi-equipo-lista" role="listbox" [attr.aria-label]="'compat.selector.results' | transloco" class="overflow-hidden rounded-card border border-border">
              @for (e of resultados(); track e.id; let i = $index) {
                <li
                  role="option"
                  [id]="'mi-equipo-opcion-' + i"
                  [attr.aria-selected]="i === activa()"
                  data-track="compatibilidad.elegir-busqueda"
                  class="min-h-11 cursor-pointer px-3 py-3 text-sm hover:bg-surface-muted"
                  [class.bg-surface-muted]="i === activa()"
                  (mousedown)="$event.preventDefault()"
                  (click)="elegir(e, 'busqueda')"
                >{{ etiqueta(e) }}</li>
              }
            </ul>
          } @else if (sinResultados()) {
            <!-- Salida concreta cuando el modelo no está (H9). -->
            <div role="status" class="rounded-card bg-surface-muted p-3 text-sm">
              <p class="font-semibold">{{ 'compat.selector.notFound' | transloco }}</p>
              <p class="mt-1 text-muted">{{ 'compat.selector.notFoundHelp' | transloco }}</p>
              <a routerLink="/buscar" data-track="compatibilidad.buscar-pn" class="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline" (click)="ref.close()">{{ 'compat.selector.goSearch' | transloco }}</a>
            </div>
          }
        </section>

        <!-- Forma 2: paso a paso. -->
        <section class="grid gap-2">
          <h3 class="text-sm font-semibold">{{ 'compat.selector.steps' | transloco }}</h3>
          <label for="mi-equipo-marca" class="text-xs text-muted">{{ 'compat.selector.brand' | transloco }}</label>
          <select
            id="mi-equipo-marca"
            class="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm"
            (change)="marcaId.set(+$any($event.target).value || null)"
          >
            <option value="">{{ 'compat.selector.brandPlaceholder' | transloco }}</option>
            @for (m of marcas(); track m.id) {
              <option [value]="m.id">{{ m.nombre }}</option>
            }
          </select>
          @if (modelos().length) {
            <p class="mt-1 text-xs text-muted" id="mi-equipo-modelos-titulo">{{ 'compat.selector.model' | transloco }}</p>
            <ul class="grid gap-1" aria-labelledby="mi-equipo-modelos-titulo">
              @for (e of modelos(); track e.id) {
                <li>
                  <button
                    type="button"
                    data-track="compatibilidad.elegir-modelo"
                    class="min-h-11 w-full rounded-control border border-border px-3 text-left text-sm hover:bg-surface-muted"
                    (click)="elegir(e, 'pasos')"
                  >{{ e.modelo }}{{ e.codigo_modelo ? ' · ' + e.codigo_modelo : '' }}</button>
                </li>
              }
            </ul>
          }
        </section>

        <!-- Ayuda (H10): dónde está el modelo. El dibujo va en línea para usar los colores de los tokens. -->
        <details class="rounded-control border border-border">
          <summary data-track="compatibilidad.ayuda-modelo" class="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{{ 'compat.help.title' | transloco }}</summary>
          <div class="grid gap-3 px-3 pb-3 text-sm">
            <svg viewBox="0 0 240 120" role="img" [attr.aria-label]="'compat.help.alt' | transloco" class="w-full max-w-xs justify-self-center text-muted">
              <rect x="20" y="8" width="200" height="104" rx="10" fill="none" stroke="currentColor" stroke-width="3" />
              <circle cx="40" cy="24" r="5" fill="currentColor" />
              <circle cx="200" cy="24" r="5" fill="currentColor" />
              <circle cx="40" cy="96" r="5" fill="currentColor" />
              <circle cx="200" cy="96" r="5" fill="currentColor" />
              <g class="text-primary">
                <rect x="70" y="52" width="100" height="34" rx="3" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="3" />
                <line x1="80" y1="63" x2="150" y2="63" stroke="currentColor" stroke-width="3" />
                <line x1="80" y1="74" x2="125" y2="74" stroke="currentColor" stroke-width="3" />
              </g>
            </svg>
            <ol class="list-decimal pl-5">
              <li>{{ 'compat.help.place1' | transloco }}</li>
              <li>{{ 'compat.help.place2' | transloco }}</li>
            </ol>
          </div>
        </details>
      </div>
    </div>
  `,
})
export class MiEquipoSelector {
  protected readonly ref = inject<DialogRef<EleccionEquipo>>(DialogRef);
  private readonly datos = inject<DatosSelector>(DIALOG_DATA);

  protected readonly texto = signal('');
  protected readonly activa = signal(-1);
  protected readonly marcaId = signal<number | null>(null);

  protected readonly marcas = computed(() => marcasConEquipos(this.datos.equipos, this.datos.marcas));
  protected readonly modelos = computed(() => (this.marcaId() === null ? [] : equiposDe(this.datos.equipos, this.marcaId()!)));
  protected readonly resultados = computed(() => buscarEquipos(this.texto(), this.datos.equipos, this.datos.marcas));
  protected readonly hayLista = computed(() => this.resultados().length > 0);
  protected readonly sinResultados = computed(() => this.texto().trim().length > 0 && this.resultados().length === 0);

  protected etiqueta(e: Equipo): string {
    const marca = this.datos.marcas.find((m) => m.id === e.marca_id)?.nombre ?? '';
    return `${marca} ${e.modelo}${e.codigo_modelo ? ' · ' + e.codigo_modelo : ''}`.trim();
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.activa.set(-1);
  }

  protected teclear(e: KeyboardEvent): void {
    const n = this.resultados().length;
    if (!n) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activa.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activa.update((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Enter sin marcar nada elige el primero: quien escribe el código exacto llega con un solo gesto (H7).
      this.elegir(this.resultados()[this.activa() >= 0 ? this.activa() : 0], 'busqueda');
    }
  }

  protected elegir(e: Equipo, forma: EleccionEquipo['forma']): void {
    this.ref.close({ equipoId: e.id, forma });
  }
}
