import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ResultadoCompat } from '../../../core/compat/compat.logic';
import { Icon, IconName } from '../icon/icon';

const ICONO: Record<'compatible' | 'incompatible' | 'sin_datos', IconName> = { compatible: 'compatible', incompatible: 'incompatible', sin_datos: 'sinConfirmar' };
const COLOR: Record<'compatible' | 'incompatible' | 'sin_datos', string> = { compatible: 'text-success', incompatible: 'text-danger', sin_datos: 'text-muted' };
const CLAVE: Record<'compatible' | 'incompatible' | 'sin_datos', string> = { compatible: 'ok', incompatible: 'no', sin_datos: 'unknown' };

/**
 * El sello ✓ / ✗ / ? (spec 003, HU-2). Siempre ícono + texto + color: nunca solo color. El mismo sello en la tarjeta, la ficha y el
 * carrito (H4). `compacto` = una línea; `detallado` (ficha) agrega el nombre del equipo, el porqué y la salida "Ver los que sí son".
 * No dibuja nada si el producto no aplica (CA-2.5, H8).
 */
@Component({
  selector: 'app-compat-badge',
  imports: [TranslocoPipe, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estado(); as e) {
      <div data-zone="compatibilidad" class="grid gap-1 text-sm">
        <p class="flex items-start gap-1.5 font-semibold" [class]="color()">
          <app-icon [name]="icono()" [size]="18" class="mt-0.5" />
          <span>
            @if (variante() === 'compacto') {
              {{ 'compat.badge.' + clave() | transloco }}
            } @else {
              {{ 'compat.detail.' + clave() | transloco: { equipo: equipoNombre() } }}
            }
          </span>
        </p>

        @if (variante() === 'detallado') {
          @if (resultado().nivel === 'atributos') {
            <!-- Por qué (CA-2.3, H2, H10). -->
            <ul class="grid gap-0.5 pl-6 text-foreground">
              @for (a of resultado().atributos; track a.clave) {
                <li>{{ 'compat.detail.attr' | transloco: { atributo: ('attr.' + a.clave + '.label' | transloco), equipo: a.equipo, producto: a.producto } }}</li>
              }
            </ul>
          }
          @if (e === 'incompatible') {
            @if (resultado().paraEquipos?.length) {
              <p class="pl-6 text-foreground">{{ 'compat.detail.forModels' | transloco: { modelos: resultado().paraEquipos!.join(', ') } }}</p>
            }
            @if (subcategoria()) {
              <a
                [routerLink]="['/catalogo', subcategoria()]"
                [queryParams]="{ compat: 1 }"
                data-track="compatibilidad.ver-compatibles"
                class="inline-flex min-h-11 items-center pl-6 font-semibold text-primary underline"
              >{{ 'compat.seeCompatible' | transloco }}</a>
            }
          }
          @if (e === 'sin_datos') {
            <p class="pl-6 text-muted">{{ 'compat.detail.unknownHelp' | transloco }}</p>
          }
        }
      </div>
    }
  `,
})
export class CompatBadge {
  readonly resultado = input.required<ResultadoCompat>();
  readonly equipoNombre = input('');
  readonly variante = input<'compacto' | 'detallado'>('compacto');
  /** Slug de la subcategoría del producto, para "Ver los que sí son compatibles" (CA-3.4). */
  readonly subcategoria = input('');

  protected readonly estado = computed(() => (this.resultado().estado === 'no_aplica' ? null : (this.resultado().estado as 'compatible' | 'incompatible' | 'sin_datos')));
  protected readonly icono = computed(() => ICONO[this.estado() ?? 'sin_datos']);
  protected readonly color = computed(() => COLOR[this.estado() ?? 'sin_datos']);
  protected readonly clave = computed(() => CLAVE[this.estado() ?? 'sin_datos']);
}
