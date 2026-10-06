import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideTransloco } from '@jsverse/transloco';
import { PasswordField } from './password-field';

@Component({
  imports: [ReactiveFormsModule, PasswordField],
  template: `<app-password-field inputId="clave" [formControl]="control" />`,
})
class Anfitrion {
  control = new FormControl('secreta1', { nonNullable: true });
}

describe('PasswordField', () => {
  it('alternar Mostrar/Ocultar no borra el valor, cambia el type y aria-pressed', async () => {
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideZonelessChangeDetection(), provideTransloco({ config: { availableLangs: ['es'], defaultLang: 'es' } })],
    });
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector('input')!;
    const boton = el.querySelector('button')!;

    expect([input.type, input.value, boton.getAttribute('aria-pressed')]).toEqual(['password', 'secreta1', 'false']);

    boton.click();
    await fixture.whenStable();
    expect([input.type, input.value, boton.getAttribute('aria-pressed')]).toEqual(['text', 'secreta1', 'true']);
    expect(boton.getAttribute('aria-controls')).toBe('clave');

    input.value = 'nueva2026';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.control.value).toBe('nueva2026');
  });
});
