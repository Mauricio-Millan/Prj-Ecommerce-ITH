import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { Stepper } from './stepper';

describe('Stepper (spec 006, CA-1.3)', () => {
  const crear = (actual: number) => {
    TestBed.configureTestingModule({ imports: [Stepper], providers: [provideZonelessChangeDetection(), provideTransloco({ config: { availableLangs: ['es-PE'], defaultLang: 'es-PE' } })] });
    const fixture = TestBed.createComponent(Stepper);
    fixture.componentRef.setInput('pasos', [{ clave: 'a' }, { clave: 'b' }]);
    fixture.componentRef.setInput('actual', actual);
    return fixture;
  };

  it('el paso actual lleva aria-current="step" y los pendientes no son botones', async () => {
    const fixture = crear(0);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('[aria-current="step"]').length).toBe(1);
    expect(el.querySelectorAll('button').length).toBe(0);
  });

  it('los pasos terminados son botones que emiten su índice para volver a editarlos', async () => {
    const fixture = crear(1);
    const ir = jasmine.createSpy('ir');
    fixture.componentInstance.ir.subscribe(ir);
    await fixture.whenStable();
    const botones = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(botones.length).toBe(1);
    botones[0].click();
    expect(ir).toHaveBeenCalledWith(0);
  });
});
