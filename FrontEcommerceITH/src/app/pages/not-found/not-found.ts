import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** 404 en lenguaje natural, sin códigos técnicos, con salidas al inicio y al buscador (CA-1.6, H2, H9). */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 class="text-2xl font-bold md:text-3xl">{{ 'notFound.title' | transloco }}</h1>
      <p class="mt-3 text-muted">{{ 'notFound.body' | transloco }}</p>
      <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          routerLink="/"
          data-zone="cta-principal"
          data-track="cta-principal.inicio"
          class="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover"
        >{{ 'notFound.home' | transloco }}</a>
        <button
          type="button"
          data-track="no-encontrado.buscar"
          class="inline-flex min-h-11 items-center justify-center rounded-control border border-primary px-5 font-semibold text-primary hover:bg-surface-muted"
          (click)="irAlBuscador()"
        >{{ 'notFound.search' | transloco }}</button>
      </div>
    </section>
  `,
})
export default class NotFound {
  private readonly document = inject(DOCUMENT);

  protected irAlBuscador(): void {
    this.document.getElementById('buscador')?.focus();
  }
}
