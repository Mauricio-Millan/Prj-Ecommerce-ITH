import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Pagination } from './pagination';

describe('Pagination', () => {
  const crear = async (pagina: number, total: number) => {
    TestBed.configureTestingModule({
      imports: [Pagination, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('pagina', pagina);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('tamano', 12);
    await fixture.whenStable();
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    return { fixture, botones };
  };

  it('con 12 productos o menos no se muestra (una sola página)', async () => {
    expect((await crear(1, 12)).botones.length).toBe(0);
  });

  it('con 13 productos hay 2 páginas; "Anterior" deshabilitado en la primera y "Siguiente" en la última (CA-3.6)', async () => {
    let { botones } = await crear(1, 13);
    expect(botones.length).toBe(4); // Anterior, 1, 2, Siguiente
    expect(botones[0].disabled).toBeTrue();
    expect(botones[3].disabled).toBeFalse();
    expect(botones[1].getAttribute('aria-current')).toBe('page');

    TestBed.resetTestingModule();
    ({ botones } = await crear(2, 13));
    expect(botones[3].disabled).toBeTrue();
  });

  it('emite el número de página elegido', async () => {
    const { fixture, botones } = await crear(1, 40);
    const emitido = jasmine.createSpy('cambiar');
    fixture.componentInstance.cambiar.subscribe(emitido);
    botones[2].click(); // "2"
    expect(emitido).toHaveBeenCalledOnceWith(2);
  });
});
