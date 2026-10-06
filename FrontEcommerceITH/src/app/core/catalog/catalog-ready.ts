import { inject, provideAppInitializer } from '@angular/core';
import { CatalogApi } from './catalog.api';

/** Precarga el catálogo antes del primer render: el encabezado y el inicio ya tienen sus categorías (mismo criterio que idioma y moneda). */
export const provideCatalogReady = () => provideAppInitializer(() => inject(CatalogApi).precargar());
