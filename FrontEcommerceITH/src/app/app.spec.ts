import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('se crea con el router y la región de avisos', () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
