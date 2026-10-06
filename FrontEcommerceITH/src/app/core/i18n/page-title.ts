import { effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';

/** Título de la pestaña traducido ("Iniciar sesión · TechSuply"); cambia solo al cambiar el idioma. Solo en un contexto de inyección. */
export function tituloDePagina(clave: string): void {
  const title = inject(Title);
  const transloco = inject(TranslocoService);
  const lang = inject(LanguageService).lang;
  effect(() => {
    lang();
    title.setTitle(`${transloco.translate(clave)} · TechSuply`);
  });
}
