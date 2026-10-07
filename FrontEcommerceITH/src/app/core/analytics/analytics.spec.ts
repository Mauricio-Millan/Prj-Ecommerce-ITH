import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Analytics } from './analytics';

describe('Analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
  });

  it('sin ID de medición no muestra el aviso ni carga ningún script de Google', () => {
    const analytics = TestBed.inject(Analytics);
    analytics.init();
    analytics.responder('aceptado');
    analytics.evento('add_to_cart', { sku: 'X', origen: 'ficha' });
    expect(analytics.disponible).toBe(false);
    expect(analytics.mostrarAviso()).toBe(false);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('guarda la decisión de cookies', () => {
    const analytics = TestBed.inject(Analytics);
    analytics.responder('rechazado');
    expect(JSON.parse(localStorage.getItem('ts_consent_analytics')!)).toBe('rechazado');
  });
});
