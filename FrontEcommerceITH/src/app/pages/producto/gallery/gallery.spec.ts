import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Gallery } from './gallery';

const imagenes = [
  { url: 'a.svg', alt: 'Vista principal', orden: 1 },
  { url: 'b.svg', alt: 'Vista alternativa', orden: 2 },
];

describe('Gallery (CA-5.6)', () => {
  const crear = async (lista = imagenes) => {
    TestBed.configureTestingModule({
      imports: [Gallery, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(Gallery);
    fixture.componentRef.setInput('imagenes', lista);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, principal: () => el.querySelector<HTMLImageElement>('img')! };
  };

  it('con una sola imagen no hay controles', async () => {
    const { el } = await crear([imagenes[0]]);
    expect(el.querySelectorAll('button').length).toBe(0);
  });

  it('las flechas del teclado cambian de imagen y cada una lleva su alt', async () => {
    const { fixture, el, principal } = await crear();
    expect(principal().alt).toBe('Vista principal');
    el.querySelector('[role=group]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(principal().alt).toBe('Vista alternativa');
    el.querySelector('[role=group]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(principal().alt).toBe('Vista principal'); // da la vuelta
  });

  it('las miniaturas son botones que eligen la imagen', async () => {
    const { fixture, el, principal } = await crear();
    const miniaturas = el.querySelectorAll<HTMLButtonElement>('ul button');
    miniaturas[1].click();
    await fixture.whenStable();
    expect(principal().alt).toBe('Vista alternativa');
    expect(miniaturas[1].getAttribute('aria-current')).toBe('true');
  });
});
