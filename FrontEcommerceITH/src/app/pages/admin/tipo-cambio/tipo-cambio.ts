import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencyService } from '../../../core/currency/currency.service';
import { ExchangeRateApi, TipoCambio, valorTipoCambioValido } from '../../../core/currency/exchange-rate.api';
import { LanguageService } from '../../../core/i18n/language.service';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { AdminField, describedBy } from '../../../shared/ui/admin-field/admin-field';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { ToastService } from '../../../shared/ui/toast/toast';

/** Tipo de cambio (spec 009, HU-5): vigente, historial inmutable y registro de uno nuevo con vista previa y confirmación. */
@Component({
  selector: 'app-tipo-cambio-admin',
  imports: [TranslocoPipe, AdminField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-tipo-cambio" class="mx-auto grid max-w-3xl gap-6">
      <h1 class="text-2xl font-bold">{{ 'adminRate.title' | transloco }}</h1>

      <section class="rounded-card border border-border p-4" aria-labelledby="tc-vigente">
        <h2 id="tc-vigente" class="text-sm font-semibold text-muted">{{ 'adminRate.current' | transloco }}</h2>
        @if (vigente(); as v) {
          <p class="mt-1 text-2xl font-bold">1 USD = S/ {{ v.valor }}</p>
          <p class="text-sm text-muted">{{ fecha(v.fecha) }}</p>
        } @else {
          <p class="mt-1 font-semibold">{{ 'adminRate.none' | transloco }}</p>
        }
      </section>

      <form class="grid gap-3 rounded-card border border-border p-4" novalidate (submit)="pedirConfirmacion($event)">
        <h2 class="text-lg font-semibold">{{ 'adminRate.register' | transloco }}</h2>
        <app-admin-field campoId="tc-valor" etiqueta="adminRate.value" ayuda="adminRate.help" [error]="error()" [requerido]="true">
          <input id="tc-valor" type="text" inputmode="decimal" [class]="error() ? campoError : campo" [value]="valor()" [attr.aria-invalid]="!!error()" [attr.aria-describedby]="describe()" (input)="valor.set($any($event.target).value); preview.set(false)" />
        </app-admin-field>
        @if (preview()) {
          <div role="alert" class="grid gap-2 rounded-card bg-surface-muted p-3">
            <p class="font-semibold">{{ 'adminRate.preview' | transloco: { valor: valorNormalizado() } }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-track="admin.tc-confirmar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="registrar()">{{ 'adminRate.confirm' | transloco }}</button>
              <button type="button" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface" (click)="preview.set(false)">{{ 'adminProduct.form.cancel' | transloco }}</button>
            </div>
          </div>
        } @else {
          <button type="submit" class="min-h-11 justify-self-start rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'adminRate.review' | transloco }}</button>
        }
      </form>

      <section class="grid gap-2" aria-labelledby="tc-historial">
        <h2 id="tc-historial" class="text-lg font-semibold">{{ 'adminRate.history' | transloco }}</h2>
        <p class="text-sm text-muted">{{ 'adminRate.immutable' | transloco }}</p>
        <div class="overflow-x-auto rounded-card border border-border">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">{{ 'adminRate.history' | transloco }}</caption>
            <thead class="bg-surface-muted">
              <tr>
                <th scope="col" class="px-3 py-2 font-semibold">{{ 'adminRate.date' | transloco }}</th>
                <th scope="col" class="px-3 py-2 font-semibold">{{ 'adminRate.value' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (h of historial(); track h.fecha) {
                <tr class="border-t border-border">
                  <th scope="row" class="px-3 py-2 font-normal">{{ fecha(h.fecha) }}</th>
                  <td class="px-3 py-2">S/ {{ h.valor }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export default class TipoCambioAdmin {
  private readonly api = inject(ExchangeRateApi);
  private readonly currency = inject(CurrencyService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService).lang;

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;
  private readonly lista = signal<TipoCambio[]>([]);
  protected readonly historial = this.lista.asReadonly();
  protected readonly vigente = computed(() => this.lista()[0] ?? null);
  protected readonly valor = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly preview = signal(false);
  protected readonly valorNormalizado = computed(() => (valorTipoCambioValido(this.valor()) ? Number(this.valor()).toFixed(4) : ''));
  protected readonly describe = computed(() => describedBy('tc-valor', true, this.error()));

  constructor() {
    tituloDePagina('adminRate.title');
    this.api.historial().subscribe((l) => this.lista.set(l));
  }

  protected fecha = (iso: string): string => new Date(iso).toLocaleString(this.lang());

  protected pedirConfirmacion(ev: Event): void {
    ev.preventDefault();
    if (!valorTipoCambioValido(this.valor())) {
      this.error.set('tipo-cambio');
      this.preview.set(false);
      return;
    }
    this.error.set(null);
    this.preview.set(true);
  }

  protected registrar(): void {
    this.api.registrar(this.valor().trim()).subscribe((tc) => {
      this.currency.exchangeRate.set(tc); // los precios en soles de la tienda se recalculan solos (CA-5.4)
      this.api.historial().subscribe((l) => this.lista.set(l));
      this.valor.set('');
      this.preview.set(false);
      this.toast.show('adminRate.saved', 'exito', [], { valor: tc.valor });
    });
  }
}
