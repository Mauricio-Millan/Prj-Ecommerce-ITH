import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SusForm } from './sus-form';

describe('SusForm', () => {
  it('con 9 respuestas no envía y enfoca la que falta (CA-5.3)', async () => {
    TestBed.configureTestingModule({
      imports: [SusForm, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(SusForm);
    const el: HTMLElement = fixture.nativeElement;
    document.body.appendChild(el);
    await fixture.whenStable();
    const enviado = jasmine.createSpy('enviado');
    fixture.componentInstance.enviado.subscribe(enviado);
    const radio = (n: number, v: number) => el.querySelector<HTMLInputElement>(`#sus-q${n}-${v}`)!;
    const enviar = () => el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();

    for (let n = 1; n <= 10; n++) if (n !== 7) radio(n, 3).click();
    enviar();
    await fixture.whenStable();
    expect(enviado).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('sus-q7-1');

    radio(7, 4).click();
    enviar();
    expect(enviado).toHaveBeenCalledWith([3, 3, 3, 3, 3, 3, 4, 3, 3, 3]);
    el.remove();
  });
});
