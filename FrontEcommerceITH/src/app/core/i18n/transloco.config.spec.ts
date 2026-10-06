import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule, provideTranslocoMissingHandler } from '@jsverse/transloco';
import { SilentMissingHandler } from './transloco.config';

describe('Traducciones faltantes (CA-2.6)', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { 'es-PE': { a: 'Hola', solo_es: 'Solo en español' }, 'en-US': { a: 'Hello' } },
          translocoConfig: {
            availableLangs: ['es-PE', 'en-US'],
            defaultLang: 'en-US',
            fallbackLang: 'es-PE',
            missingHandler: { useFallbackTranslation: true, logMissingKey: false },
          },
          preloadLangs: true,
        }),
      ],
      providers: [provideZonelessChangeDetection(), provideTranslocoMissingHandler(SilentMissingHandler)],
    });
    transloco = TestBed.inject(TranslocoService);
  });

  it('una clave que existe solo en es-PE se muestra en español con en-US activo', () => {
    expect(transloco.translate('a')).toBe('Hello');
    expect(transloco.translate('solo_es')).toBe('Solo en español');
  });

  it('una clave que no existe en ningún idioma nunca muestra la clave técnica', () => {
    spyOn(console, 'warn');
    expect(transloco.translate('checkout.title')).toBe('');
  });
});
