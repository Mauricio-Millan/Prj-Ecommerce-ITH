import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

const BOTON = 'inline-flex min-h-11 min-w-11 items-center justify-center border border-border bg-surface text-lg hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-muted';

/** Cantidad entre 1 y `max` (H5). Al escribir más del stock se ajusta al máximo y avisa "Solo quedan N unidades" (H9). La reutiliza el carrito (005). */
@Component({
  selector: 'app-quantity-input',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-stretch" role="group" [attr.aria-label]="'catalog.quantity' | transloco">
      <button
        type="button"
        class="rounded-l-control"
        [class]="boton"
        [attr.aria-label]="('catalog.quantityDec' | transloco) + (etiqueta() ? ' · ' + etiqueta() : '')"
        [attr.data-track]="seguimiento() ? seguimiento() + '.cantidad-menos' : null"
        [disabled]="valor() <= 1"
        (click)="fijar(valor() - 1)"
      >−</button>
      <input
        #campo
        type="number"
        inputmode="numeric"
        min="1"
        [max]="max()"
        [value]="valor()"
        [attr.aria-label]="'catalog.quantity' | transloco"
        class="min-h-11 w-14 border-y border-border bg-surface text-center tabular-nums"
        (input)="alEscribir(campo)"
        (change)="alConfirmar(campo)"
      />
      <button
        type="button"
        class="rounded-r-control"
        [class]="boton"
        [attr.aria-label]="('catalog.quantityInc' | transloco) + (etiqueta() ? ' · ' + etiqueta() : '')"
        [attr.data-track]="seguimiento() ? seguimiento() + '.cantidad-mas' : null"
        [disabled]="valor() >= max()"
        (click)="fijar(valor() + 1)"
      >+</button>
    </div>
    @if (aviso()) {
      <p role="status" class="mt-1 text-sm font-medium text-warning">{{ 'catalog.onlyN' | transloco: { n: max() } }}</p>
    }
  `,
})
export class QuantityInput {
  readonly max = input.required<number>();
  readonly valor = model(1);
  /** Nombre del producto: se agrega a los aria-label de los botones (carrito, spec 005). */
  readonly etiqueta = input('');
  /** Prefijo de data-track: "linea-carrito" da "linea-carrito.cantidad-menos" y ".cantidad-mas". */
  readonly seguimiento = input('');

  protected readonly boton = BOTON;
  protected readonly aviso = signal(false);

  protected fijar(n: number): void {
    this.aviso.set(false);
    this.valor.set(Math.min(Math.max(1, n), this.max()));
  }

  protected alEscribir(campo: HTMLInputElement): void {
    const n = Number.parseInt(campo.value, 10);
    if (Number.isNaN(n) || n < 1) return; // vacío o en curso: se corrige al salir del campo
    if (n > this.max()) {
      campo.value = String(this.max());
      this.valor.set(this.max());
      this.aviso.set(true);
    } else {
      this.fijar(n);
    }
  }

  protected alConfirmar(campo: HTMLInputElement): void {
    const n = Number.parseInt(campo.value, 10);
    this.fijar(Number.isNaN(n) ? 1 : n);
    campo.value = String(this.valor());
  }
}
