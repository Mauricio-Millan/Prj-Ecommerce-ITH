import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ErrorResumen {
  /** `id` del campo en el DOM. */
  id: string;
  /** Clave de traducción de su etiqueta. */
  etiquetaClave: string;
}

/** "Revisa N campos" con un enlace a cada uno (CA-2.6, H4). Se anuncia solo (`role="alert"`). */
@Component({
  selector: 'app-form-error-summary',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errores().length) {
      <div #caja role="alert" tabindex="-1" class="rounded-control border border-danger bg-surface-muted p-3 text-sm">
        <p class="font-semibold text-danger">{{ (errores().length === 1 ? 'validation.summaryOne' : 'validation.summary') | transloco: { n: errores().length } }}</p>
        <ul class="mt-1 list-disc pl-5">
          @for (e of errores(); track e.id) {
            <li><a [href]="'#' + e.id" class="inline-flex min-h-11 items-center font-medium text-primary underline" (click)="ir($event, e.id)">{{ e.etiquetaClave | transloco }}</a></li>
          }
        </ul>
      </div>
    }
  `,
})
export class FormErrorSummary {
  readonly errores = input.required<ErrorResumen[]>();
  private readonly document = inject(DOCUMENT);
  private readonly caja = viewChild<ElementRef<HTMLElement>>('caja');

  protected ir(evento: Event, id: string): void {
    evento.preventDefault();
    this.document.getElementById(id)?.focus();
  }

  /** Mueve el foco al resumen (cuando no hay un campo al que ir). */
  enfocar(): void {
    this.caja()?.nativeElement.focus();
  }
}
