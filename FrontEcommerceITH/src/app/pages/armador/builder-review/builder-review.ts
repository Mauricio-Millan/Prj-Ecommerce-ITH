import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EstadoArmado, Motivo } from '../../../core/builder/builder.models';
import { PasoId } from '../../../core/builder/pasos';
import { Moneda } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatear } from '../../../shared/ui/price/price';
import { MotivoTraductor } from '../motivo-traductor';
import { LineaResumen } from '../builder-summary/builder-summary';

/**
 * Paso final "Resumen" (spec 008, HU-5): todas las piezas, el total, y "Agregar todo al carrito". Con conflictos o piezas obligatorias
 * sin elegir el botón está DESHABILITADO con su motivo al lado, y el motivo lleva al paso que corresponde (H5, H9; igual que el carrito).
 */
@Component({
  selector: 'app-builder-review',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid gap-4" aria-labelledby="armador-titulo">
      <h2 id="armador-titulo" tabindex="-1" class="text-xl font-bold outline-none">{{ 'builder.review.title' | transloco }}</h2>

      <ul class="grid gap-2">
        @for (l of lineas(); track l.paso) {
          <li class="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3 text-sm">
            <span class="min-w-0"><span class="block text-xs text-muted">{{ 'builder.step.' + l.paso | transloco }}</span><span class="font-medium">{{ l.nombre }}</span></span>
            <span class="flex shrink-0 items-center gap-3">
              <span class="tabular-nums">{{ dinero(l.centimos) }}</span>
              <button type="button" class="min-h-11 rounded-control px-2 font-semibold text-primary underline" (click)="irA.emit(l.paso)">{{ 'checkout.change' | transloco }}</button>
            </span>
          </li>
        }
      </ul>

      @for (c of estado().conflictos; track c.reglaId) {
        <p class="rounded-control border border-warning p-2 text-sm font-medium">{{ texto(c.motivo) }}</p>
      }

      <p class="flex items-baseline justify-between text-base font-bold"><span>{{ 'cart.total' | transloco }}</span><span class="text-2xl tabular-nums">{{ dinero(estado().totalCentimos) }}</span></p>

      <div class="grid gap-2">
        <button
          type="button"
          data-zone="cta-principal"
          data-track="cta-principal.agregar-armado"
          class="min-h-12 rounded-control bg-accent px-6 font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
          [disabled]="!estado().completo"
          [attr.aria-describedby]="estado().completo ? null : 'armador-motivo'"
          (click)="agregar.emit()"
        >{{ 'builder.addAll' | transloco }}</button>

        @if (!estado().completo) {
          <button id="armador-motivo" type="button" class="min-h-11 justify-self-start text-left text-sm font-medium text-danger underline" (click)="alMotivo()">{{ motivo().clave | transloco: motivo().params }}</button>
        }
        <button type="button" data-track="armador.empezar-de-nuevo" class="min-h-11 justify-self-start rounded-control px-2 text-sm font-semibold text-primary underline" (click)="reiniciar.emit()">{{ 'builder.startOver' | transloco }}</button>
      </div>
    </section>
  `,
})
export class BuilderReview {
  readonly estado = input.required<EstadoArmado>();
  readonly lineas = input.required<LineaResumen[]>();
  readonly moneda = input<Moneda>('PEN');
  /** Nombres de los pasos obligatorios que faltan, ya traducidos ("Fuente de poder, Case"). */
  readonly nombresFaltantes = input<string>('');
  readonly pasoDeConflicto = input<PasoId | null>(null);
  readonly agregar = output<void>();
  readonly irA = output<PasoId>();
  readonly reiniciar = output<void>();

  private readonly lang = inject(LanguageService).lang;
  private readonly motivos = inject(MotivoTraductor);
  protected readonly dinero = (c: number) => formatear(c, this.moneda(), this.lang());
  protected readonly texto = (m: Motivo) => this.motivos.texto(m);

  /** Qué impide agregar: primero los conflictos, luego lo que falta (CA-5.2). */
  protected readonly motivo = computed(() => {
    const e = this.estado();
    const problemas = e.conflictos.length + e.noDisponibles.length;
    return problemas
      ? { clave: problemas === 1 ? 'builder.resolveOne' : 'builder.resolve', params: { n: problemas } }
      : { clave: 'builder.missing', params: { piezas: this.nombresFaltantes() } };
  });

  protected alMotivo(): void {
    const e = this.estado();
    const paso = e.conflictos.length || e.noDisponibles.length ? this.pasoDeConflicto() : e.faltantes[0];
    if (paso) this.irA.emit(paso);
  }
}
