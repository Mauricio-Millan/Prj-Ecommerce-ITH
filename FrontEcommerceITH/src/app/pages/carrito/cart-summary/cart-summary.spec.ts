import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { ResumenCarrito } from '../../../core/cart/cart.models';
import { CartSummary } from './cart-summary';

const resumen = (extra: Partial<ResumenCarrito>): ResumenCarrito => ({ unidades: 2, totalPenCentimos: 27938, totalUsdCentimos: 7450, agotados: 0, puedePagar: true, motivo: null, ...extra });

describe('CartSummary', () => {
  const crear = (r: ResumenCarrito, moneda: 'PEN' | 'USD' = 'PEN', tc: { valor: string; fecha: string } | null = { valor: '3.75', fecha: '2026-10-05' }) => {
    TestBed.configureTestingModule({
      imports: [CartSummary],
      providers: [provideZonelessChangeDetection(), provideTransloco({ config: { availableLangs: ['es-PE'], defaultLang: 'es-PE' } })],
    });
    const fixture = TestBed.createComponent(CartSummary);
    fixture.componentRef.setInput('resumen', r);
    fixture.componentRef.setInput('moneda', moneda);
    fixture.componentRef.setInput('tc', tc);
    return fixture;
  };

  it('con agotados el botón está deshabilitado y el motivo (con N) queda visible; tocarlo emite irAAgotado', async () => {
    const fixture = crear(resumen({ puedePagar: false, motivo: 'agotados', agotados: 2 }));
    const irAAgotado = jasmine.createSpy('irAAgotado');
    fixture.componentInstance.irAAgotado.subscribe(irAAgotado);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector<HTMLButtonElement>('[data-track="cta-principal.continuar-pago"]')!.disabled).toBeTrue();
    const motivo = el.querySelector<HTMLButtonElement>('#motivo-pago')!;
    expect(motivo).not.toBeNull();
    motivo.click();
    expect(irAAgotado).toHaveBeenCalledTimes(1);
  });

  it('sin tipo de cambio: deshabilitado, con el motivo en texto y los montos en USD', async () => {
    const fixture = crear(resumen({ puedePagar: false, motivo: 'sin-tc', totalPenCentimos: 0 }), 'USD', null);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector<HTMLButtonElement>('[data-track="cta-principal.continuar-pago"]')!.disabled).toBeTrue();
    expect(el.querySelector('#motivo-pago')?.getAttribute('role')).toBe('status');
    expect(el.textContent).toMatch(/74\.50/);
    expect(el.textContent).not.toContain('cart.youPay');
  });

  it('listo para pagar: botón habilitado y sin motivo; viendo USD aparece "Pagarás S/ …" con el monto real en soles', async () => {
    const fixture = crear(resumen({}), 'USD');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector<HTMLButtonElement>('[data-track="cta-principal.continuar-pago"]')!.disabled).toBeFalse();
    expect(el.querySelector('#motivo-pago')).toBeNull();
    expect(el.textContent).toMatch(/74\.50/);
    // Sin traducciones cargadas se ve la clave: "Pagarás S/ …" aparece solo al ver USD con tipo de cambio.
    expect(el.textContent).toContain('cart.youPay');
  });
});
