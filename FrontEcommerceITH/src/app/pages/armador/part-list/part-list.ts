import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Candidata, Motivo } from '../../../core/builder/builder.models';
import { specsClave } from '../../../core/builder/builder.logic';
import { PasoId } from '../../../core/builder/pasos';
import { Atributo, Producto } from '../../../core/catalog/catalog.models';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Price, formatear } from '../../../shared/ui/price/price';
import { StockBadge } from '../../../shared/ui/stock-badge/stock-badge';
import { MotivoTraductor } from '../motivo-traductor';

export interface PiezaVista {
  producto: Producto;
  evaluacion: Candidata;
  /** Con presupuesto: "+S/ X" y lo que quedaría (CA-3.4). */
  costo: { incremento: number; quedaria: number | null };
}

/**
 * Las piezas de un paso (spec 008, HU-2): `radiogroup` operable con teclado. Por defecto solo las compatibles con lo ya elegido; las que
 * no calzan se muestran DESHABILITADAS con su motivo si el usuario lo pide (H5, H7, H9). Las agotadas no se pueden elegir (CA-2.4).
 */
@Component({
  selector: 'app-part-list',
  imports: [TranslocoPipe, Icon, Price, StockBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="armador-paso" class="grid min-w-0 gap-3">
      <!-- La pieza elegida que ya no calza o ya no está: señalada arriba con su motivo, para reemplazarla con un clic (CA-4.3). -->
      @if (enConflicto(); as c) {
        <div data-zone="armador-conflicto" class="flex items-start gap-2 rounded-card border border-warning bg-surface-muted p-3 text-sm">
          <app-icon name="advertencia" [size]="18" class="text-warning" />
          <div>
            <p class="font-semibold">{{ 'builder.yourPiece' | transloco: { nombre: c.nombre } }}</p>
            @for (m of c.motivos; track m.reglaId) { <p>{{ texto(m) }}</p> }
            @if (c.noDisponible) { <p>{{ 'builder.unavailable' | transloco }}</p> }
          </div>
        </div>
      }

      @if (visibles().length) {
        <ul role="radiogroup" [attr.aria-label]="'builder.pieces' | transloco" class="grid gap-2">
          @for (v of visibles(); track v.producto.sku) {
            <li>
              <button
                type="button"
                role="radio"
                data-track="armador.elegir"
                class="flex min-h-20 w-full items-start gap-3 rounded-card border bg-surface p-3 text-left enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                [class.border-primary]="elegida() === v.producto.sku"
                [class.border-2]="elegida() === v.producto.sku"
                [class.border-border]="elegida() !== v.producto.sku"
                [attr.aria-checked]="elegida() === v.producto.sku"
                [attr.aria-describedby]="'pieza-' + v.producto.sku + '-info'"
                [disabled]="deshabilitada(v)"
                (click)="elegir.emit(v.producto.sku)"
              >
                <img [src]="v.producto.imagenes[0]?.url ?? ''" alt="" width="64" height="64" class="size-16 shrink-0 rounded-control bg-surface-muted object-cover" />
                <span class="grid min-w-0 flex-1 gap-1">
                  <span class="font-medium">{{ v.producto.nombre }}</span>
                  <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <app-price [usd]="v.producto.precio_usd" [mostrarNota]="false" />
                    <app-stock-badge [stock]="v.producto.stock" />
                  </span>
                  <span class="flex flex-wrap gap-x-3 text-xs text-muted">
                    @for (s of specs(v.producto); track s.etiqueta) {
                      <span>{{ s.etiqueta | transloco }}: {{ s.siNo === undefined ? s.texto : ((s.siNo ? 'catalog.yes' : 'catalog.no') | transloco) }}</span>
                    }
                  </span>
                  <span [id]="'pieza-' + v.producto.sku + '-info'" class="grid text-xs">
                    @if (!v.evaluacion.compatible) {
                      @for (m of v.evaluacion.motivos; track m.reglaId) { <span class="font-medium text-danger">{{ texto(m) }}</span> }
                    } @else if (v.producto.stock <= 0) {
                      <span class="font-medium text-danger">{{ 'stock.agotado' | transloco }}</span>
                    } @else if (v.evaluacion.sinDatos) {
                      <span class="text-muted">{{ 'builder.noData' | transloco }}</span>
                    }
                    @if (presupuesto() && v.evaluacion.compatible && v.producto.stock > 0) {
                      <span [class.text-danger]="(v.costo.quedaria ?? 0) < 0" [class.text-success]="(v.costo.quedaria ?? 0) >= 0">
                        {{ 'builder.budgetPiece' | transloco: { mas: soles(v.costo.incremento), quedan: soles(v.costo.quedaria ?? 0) } }}
                        {{ ((v.costo.quedaria ?? 0) < 0 ? 'builder.exceeds' : 'builder.fits') | transloco }}
                      </span>
                    }
                  </span>
                </span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <!-- Sin opciones: se explica y se ofrece cambiar la pieza que lo limita (CA-2.5, H9). -->
        <div class="grid gap-2 rounded-card border border-border bg-surface p-4 text-sm">
          <p class="font-semibold">{{ 'builder.noOptions' | transloco: { piezas: ('builder.plural.' + paso() | transloco) } }}</p>
          @if (limitante()) {
            <button type="button" data-track="armador.revisar-conflicto" class="min-h-11 justify-self-start rounded-control border border-border px-3 font-semibold text-primary hover:bg-surface-muted" (click)="irA.emit(limitante()!)">
              {{ 'builder.changeLimiting' | transloco: { pieza: ('builder.piece.' + limitante() | transloco) } }}
            </button>
          }
        </div>
      }

      @if (incompatibles().length) {
        <button type="button" data-track="armador.mostrar-incompatibles" class="min-h-11 justify-self-start rounded-control px-2 text-sm font-semibold text-primary underline" [attr.aria-pressed]="mostrarTodas()" (click)="mostrarTodas.set(!mostrarTodas())">
          {{ (mostrarTodas() ? 'builder.hideIncompatible' : 'builder.showIncompatible') | transloco: { n: incompatibles().length } }}
        </button>
      }
    </div>
  `,
})
export class PartList {
  readonly paso = input.required<PasoId>();
  readonly piezas = input.required<PiezaVista[]>();
  readonly elegida = input<string | null>(null);
  readonly atributos = input<Atributo[]>([]);
  readonly presupuesto = input(false);
  /** El paso anterior que limita las opciones (el procesador para las placas): para el enlace "Cambiar tu procesador". */
  readonly limitante = input<PasoId | null>(null);
  /** La pieza elegida está en conflicto o ya no está disponible. */
  readonly conflicto = input<{ nombre: string; motivos: Motivo[]; noDisponible: boolean } | null>(null);
  readonly elegir = output<string>();
  readonly irA = output<PasoId>();

  private readonly lang = inject(LanguageService).lang;
  protected readonly mostrarTodas = signal(false);
  protected readonly enConflicto = computed(() => this.conflicto());
  protected readonly incompatibles = computed(() => this.piezas().filter((p) => !p.evaluacion.compatible));
  protected readonly visibles = computed(() => (this.mostrarTodas() ? this.piezas() : this.piezas().filter((p) => p.evaluacion.compatible)));
  protected readonly soles = (c: number) => formatear(c, 'PEN', this.lang());
  protected readonly specs = (p: Producto) => specsClave(p, this.paso(), this.atributos());
  protected readonly deshabilitada = (v: PiezaVista) => !v.evaluacion.compatible || v.producto.stock <= 0;

  protected texto(m: Motivo): string {
    return this.motivos.texto(m);
  }

  private readonly motivos = inject(MotivoTraductor);
}
