import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { tituloDePagina } from '../../core/i18n/page-title';

/** Ayuda general (spec 017 HU-5): contacto, garantía y devoluciones, y cómo saber si una pieza es compatible. Contenido de ejemplo (prototipo). */
@Component({
  selector: 'app-ayuda',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto max-w-3xl px-4 py-10">
      <h1 class="text-2xl font-bold md:text-3xl">{{ 'help.title' | transloco }}</h1>
      <p class="mt-2 text-muted">{{ 'help.example' | transloco }}</p>

      <section id="contacto" class="mt-8 scroll-mt-32" aria-labelledby="ayuda-contacto">
        <h2 id="ayuda-contacto" class="text-xl font-semibold">{{ 'help.contact.title' | transloco }}</h2>
        <p class="mt-2">{{ 'help.contact.body' | transloco }}</p>
      </section>

      <section id="garantia" class="mt-8 scroll-mt-32" aria-labelledby="ayuda-garantia">
        <h2 id="ayuda-garantia" class="text-xl font-semibold">{{ 'help.warranty.title' | transloco }}</h2>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>{{ 'help.warranty.p1' | transloco }}</li>
          <li>{{ 'help.warranty.p2' | transloco }}</li>
          <li>{{ 'help.warranty.p3' | transloco }}</li>
        </ul>
      </section>

      <section id="compatibilidad" class="mt-8 scroll-mt-32" aria-labelledby="ayuda-compat">
        <h2 id="ayuda-compat" class="text-xl font-semibold">{{ 'help.compat.title' | transloco }}</h2>
        <ol class="mt-2 list-decimal space-y-1 pl-5">
          <li>{{ 'help.compat.p1' | transloco }}</li>
          <li>{{ 'help.compat.p2' | transloco }}</li>
          <li>{{ 'help.compat.p3' | transloco }}</li>
        </ol>
      </section>

      <a routerLink="/" class="mt-10 inline-flex min-h-11 items-center rounded-control font-semibold text-primary underline underline-offset-4">{{ 'help.back' | transloco }}</a>
    </article>
  `,
})
export default class Ayuda {
  constructor() {
    tituloDePagina('help.title');
  }
}
