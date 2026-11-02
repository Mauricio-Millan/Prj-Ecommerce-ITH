import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Analytics, GTM_ID_TOKEN } from './analytics';

const SCRIPT = 'script[src*="googletagmanager"]';

function preparar(gtmId: string): Analytics {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: GTM_ID_TOKEN, useValue: gtmId }],
  });
  return TestBed.inject(Analytics);
}

describe('Analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
  });
  afterEach(() => document.querySelectorAll(SCRIPT).forEach((s) => s.remove()));

  it('sin ID de contenedor no muestra el aviso ni carga ningún script de Google', () => {
    const analytics = preparar('');
    analytics.init();
    analytics.responder('aceptado');
    analytics.evento('add_to_cart', { sku: 'X', origen: 'ficha' });
    expect(analytics.disponible).toBe(false);
    expect(analytics.mostrarAviso()).toBe(false);
    expect(document.querySelector(SCRIPT)).toBeNull();
  });

  it('con ID pide el consentimiento y no carga nada hasta que se acepta', () => {
    const analytics = preparar('GTM-TEST123');
    analytics.init();
    expect(analytics.mostrarAviso()).toBe(true);
    expect(document.querySelector(SCRIPT)).toBeNull();
    analytics.evento('add_to_cart', { sku: 'X' });
    expect((window as unknown as { dataLayer: unknown[] }).dataLayer).toEqual([]);
  });

  it('tras aceptar carga el contenedor y solo envía los parámetros permitidos', () => {
    const analytics = preparar('GTM-TEST123');
    analytics.init();
    analytics.responder('aceptado');
    expect(document.querySelector(SCRIPT)?.getAttribute('src')).toContain('id=GTM-TEST123');
    analytics.evento('add_to_cart', { sku: 'X', cantidad: 2, correo: 'a@b.pe' });
    analytics.evento('search', { q: 'ram lenovo', resultados: 4 });
    const eventos = (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer.filter((e) => e['event'] !== 'gtm.js');
    expect(eventos).toContain({ event: 'add_to_cart', sku: 'X', cantidad: 2 });
    expect(eventos).toContain({ event: 'search', resultados: 4 });
  });

  it('no envía nada durante una sesión de investigación', () => {
    localStorage.setItem('ts_research_session', JSON.stringify({ id: 'P01-v1' }));
    const analytics = preparar('GTM-TEST123');
    analytics.init();
    analytics.responder('aceptado');
    expect(analytics.mostrarAviso()).toBe(false);
    expect(document.querySelector(SCRIPT)).toBeNull();
  });

  it('guarda la decisión de cookies', () => {
    const analytics = preparar('GTM-TEST123');
    analytics.responder('rechazado');
    expect(JSON.parse(localStorage.getItem('ts_consent_analytics')!)).toBe('rechazado');
  });
});

