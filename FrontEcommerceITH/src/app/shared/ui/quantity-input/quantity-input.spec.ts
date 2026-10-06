import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { QuantityInput } from './quantity-input';

describe('QuantityInput', () => {
  const crear = async (max: number) => {
    TestBed.configureTestingModule({
      imports: [QuantityInput, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(QuantityInput);
    fixture.componentRef.setInput('max', max);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el, campo: el.querySelector('input')!, menos: el.querySelector<HTMLButtonElement>('button')!, mas: el.querySelectorAll<HTMLButtonElement>('button')[1] };
  };

  it('no baja de 1: el botón − queda deshabilitado (CA-5.4)', async () => {
    const { fixture, menos } = await crear(4);
    expect(fixture.componentInstance.valor()).toBe(1);
    expect(menos.disabled).toBeTrue();
  });

  it('escribir 99 con stock 4 → 4 y aparece "Solo quedan 4 unidades"', async () => {
    const { fixture, el, campo, mas } = await crear(4);
    campo.value = '99';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(4);
    expect(campo.value).toBe('4');
    expect(el.querySelector('[role=status]')).toBeTruthy();
    expect(mas.disabled).toBeTrue();
  });

  it('vacío o 0 se corrige a 1 al salir del campo', async () => {
    const { fixture, campo } = await crear(4);
    campo.value = '0';
    campo.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(1);
    expect(campo.value).toBe('1');
  });

  it('+ y − suben y bajan dentro del rango', async () => {
    const { fixture, menos, mas } = await crear(3);
    mas.click();
    mas.click();
    mas.click(); // ya está en 3: el botón está deshabilitado y no cambia
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(3);
    menos.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe(2);
  });
});
