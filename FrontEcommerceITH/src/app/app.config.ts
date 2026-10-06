import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideTransloco, provideTranslocoMissingHandler } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';

import { routes } from './app.routes';
import { NavigationHistory } from './core/auth/volver';
import { provideCatalogReady } from './core/catalog/catalog-ready';
import { CurrencyService } from './core/currency/currency.service';
import { LanguageService } from './core/i18n/language.service';
import { SearchApi } from './core/search/search.api';
import { SilentMissingHandler, translocoOptions } from './core/i18n/transloco.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch()),
    provideTransloco(translocoOptions),
    provideTranslocoMissingHandler(SilentMissingHandler),
    provideCatalogReady(),
    provideAppInitializer(() => inject(SearchApi).precargar()),
    // Empieza a recordar la última página antes de la primera navegación (spec 004: volver a donde estaba).
    provideAppInitializer(() => void inject(NavigationHistory)),
    // Traducciones y tipo de cambio listos antes del primer render: sin parpadeo de textos ni de moneda.
    provideAppInitializer(() => forkJoin([inject(LanguageService).init(), inject(CurrencyService).init()])),
  ],
};
