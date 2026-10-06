import { ChangeDetectionStrategy, Component, DOCUMENT, inject, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

const ITEMS = Array.from({ length: 10 }, (_, i) => i + 1);
const ESCALA = [1, 2, 3, 4, 5];

/**
 * SUS a pantalla completa (HU-5). Lleva `data-research-panel`: sus clics no cuentan como interacción con la tienda (CA-5.6).
 * Los textos salen de `research.sus.q1…q10` (CA-5.2). PENDIENTE: reemplazar el español por la traducción validada que elija el equipo.
 */
@Component({
  selector: 'app-sus-form',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-research-panel': '', class: 'fixed inset-0 z-[70] overflow-y-auto bg-surface' },
  template: `
    <form class="mx-auto max-w-2xl px-4 py-8" novalidate (submit)="enviar($event)">
      <h1 class="text-2xl font-bold">{{ 'research.sus.title' | transloco }}</h1>
      <p class="mt-2 text-muted">{{ 'research.sus.intro' | transloco }}</p>

      @for (n of items; track n) {
        <fieldset class="mt-6 rounded-card border p-4" [class.border-danger]="faltante() === n" [class.border-border]="faltante() !== n">
          <legend class="px-1 font-medium">{{ n }}. {{ 'research.sus.q' + n | transloco }}</legend>
          <div class="mt-2 flex items-center justify-between gap-2 text-xs text-muted" aria-hidden="true">
            <span>{{ 'research.sus.disagree' | transloco }}</span>
            <span>{{ 'research.sus.agree' | transloco }}</span>
          </div>
          <div class="mt-1 grid grid-cols-5 gap-2">
            @for (valor of escala; track valor) {
              <label class="flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-3 has-focus-visible:outline-focus">
                <input
                  type="radio"
                  class="sr-only"
                  [id]="'sus-q' + n + '-' + valor"
                  [name]="'sus-q' + n"
                  [value]="valor"
                  [checked]="respuestas()[n - 1] === valor"
                  (change)="responder(n, valor)"
                />
                <span>{{ valor }}</span>
                @if (valor === 1) { <span class="sr-only">— {{ 'research.sus.disagree' | transloco }}</span> }
                @if (valor === 5) { <span class="sr-only">— {{ 'research.sus.agree' | transloco }}</span> }
              </label>
            }
          </div>
        </fieldset>
      }

      @if (faltante(); as n) {
        <p class="mt-6 font-medium text-danger" role="alert">{{ 'research.sus.missing' | transloco: { n } }}</p>
      }

      <div class="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="submit" class="min-h-11 rounded-control bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">
          {{ 'research.sus.submit' | transloco }}
        </button>
        <button type="button" class="min-h-11 rounded-control border border-border px-6 hover:bg-surface-muted" (click)="cancelar.emit()">
          {{ 'research.sus.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class SusForm {
  readonly enviado = output<number[]>();
  readonly cancelar = output<void>();

  private readonly document = inject(DOCUMENT);
  protected readonly items = ITEMS;
  protected readonly escala = ESCALA;
  protected readonly respuestas = signal<(number | null)[]>(ITEMS.map(() => null));
  protected readonly faltante = signal<number | null>(null);

  protected responder(n: number, valor: number): void {
    this.respuestas.update((r) => r.map((v, i) => (i === n - 1 ? valor : v)));
    if (this.faltante() === n) this.faltante.set(null);
  }

  /** No se envía incompleto: se indica y enfoca la primera afirmación sin responder (CA-5.3). */
  protected enviar(event: Event): void {
    event.preventDefault();
    const i = this.respuestas().indexOf(null);
    if (i >= 0) {
      this.faltante.set(i + 1);
      this.document.getElementById(`sus-q${i + 1}-1`)?.focus();
      return;
    }
    this.enviado.emit(this.respuestas() as number[]);
  }
}
