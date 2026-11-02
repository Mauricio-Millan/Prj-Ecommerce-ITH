import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { tituloDePagina } from '../../core/i18n/page-title';

/** Declaración de accesibilidad (spec 018 CA-7.4): nivel objetivo, lo hecho, limitaciones conocidas y cómo reportar una barrera. */
@Component({
  selector: 'app-accesibilidad',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto max-w-3xl px-4 py-10">
      <h1 class="text-2xl font-bold md:text-3xl">{{ 'a11yStatement.title' | transloco }}</h1>
      <p class="mt-2 text-muted">{{ 'a11yStatement.example' | transloco }}</p>

      <section class="mt-8" aria-labelledby="dec-nivel">
        <h2 id="dec-nivel" class="text-xl font-semibold">{{ 'a11yStatement.level.title' | transloco }}</h2>
        <p class="mt-2">{{ 'a11yStatement.level.body' | transloco }}</p>
      </section>

      <section class="mt-8" aria-labelledby="dec-hecho">
        <h2 id="dec-hecho" class="text-xl font-semibold">{{ 'a11yStatement.done.title' | transloco }}</h2>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>{{ 'a11yStatement.done.p1' | transloco }}</li>
          <li>{{ 'a11yStatement.done.p2' | transloco }}</li>
          <li>{{ 'a11yStatement.done.p3' | transloco }}</li>
          <li>{{ 'a11yStatement.done.p4' | transloco }}</li>
        </ul>
      </section>

      <section class="mt-8" aria-labelledby="dec-limites">
        <h2 id="dec-limites" class="text-xl font-semibold">{{ 'a11yStatement.limits.title' | transloco }}</h2>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>{{ 'a11yStatement.limits.p1' | transloco }}</li>
          <li>{{ 'a11yStatement.limits.p2' | transloco }}</li>
          <li>{{ 'a11yStatement.limits.p3' | transloco }}</li>
        </ul>
      </section>

      <section class="mt-8" aria-labelledby="dec-reportar">
        <h2 id="dec-reportar" class="text-xl font-semibold">{{ 'a11yStatement.report.title' | transloco }}</h2>
        <p class="mt-2">{{ 'a11yStatement.report.body' | transloco }}</p>
      </section>

      <a routerLink="/" class="mt-10 inline-flex min-h-11 items-center rounded-control font-semibold text-primary underline underline-offset-4">{{ 'help.back' | transloco }}</a>
    </article>
  `,
})
export default class Accesibilidad {
  constructor() {
    tituloDePagina('a11yStatement.title');
  }
}
