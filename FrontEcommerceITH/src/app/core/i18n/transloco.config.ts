import { HttpClient } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { Translation, TranslocoLoader, TranslocoMissingHandler, TranslocoOptions } from '@jsverse/transloco';
import { DEFAULT_LANG, LANGUAGES } from './languages';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  getTranslation(lang: string) {
    return this.http.get<Translation>(`i18n/${lang}.json`);
  }
}

/** Se llega aquí solo si la clave falta también en español: nunca se muestra la clave técnica (CA-2.6). */
@Injectable({ providedIn: 'root' })
export class SilentMissingHandler implements TranslocoMissingHandler {
  handle(key: string): string {
    if (isDevMode()) console.warn(`[i18n] Falta la clave "${key}" en ${DEFAULT_LANG}`);
    return '';
  }
}

export const translocoOptions: TranslocoOptions = {
  config: {
    availableLangs: LANGUAGES.map((l) => l.code),
    defaultLang: DEFAULT_LANG,
    fallbackLang: DEFAULT_LANG,
    reRenderOnLangChange: true,
    prodMode: !isDevMode(),
    // Una frase sin traducir en en-US / qu-PE se muestra en español (CA-2.6).
    missingHandler: { useFallbackTranslation: true, logMissingKey: false },
  },
  loader: TranslocoHttpLoader,
};
