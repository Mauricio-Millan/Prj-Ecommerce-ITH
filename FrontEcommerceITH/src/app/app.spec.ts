import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GTM_ID_TOKEN } from './core/analytics/analytics';
import { App } from './app';

describe('App', () => {
  it('se crea con el router y la región de avisos', () => {
    // Sin contenedor de analítica no hay aviso de cookies (que necesita las traducciones): esta prueba solo mira la raíz.
    TestBed.configureTestingModule({ imports: [App], providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: GTM_ID_TOKEN, useValue: '' }] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
