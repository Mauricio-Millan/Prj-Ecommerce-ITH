import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Producto } from '../../../core/catalog/catalog.models';
import { ProductCard } from './product-card';

const producto = (extra: Partial<Producto> = {}): Producto => ({
  id: 1, sku: 'MOU-M170', categoria_id: 1, marca_id: 1, nombre: 'Mouse Logitech M170 inalámbrico', modelo: 'M170', descripcion: '', numero_parte: null, precio_usd: 12.9,
  stock: 15, garantia_meses: 12, condicion: 'nuevo', especificaciones: {}, imagenes: [{ url: 'images/productos/mouse-1.svg', alt: 'x', orden: 1 }], destacado: false, activo: true,
  created_at: '2026-01-01T00:00:00Z', ...extra,
});

describe('ProductCard', () => {
  const crear = async (p: Producto) => {
    TestBed.configureTestingModule({
      imports: [
        ProductCard,
        TranslocoTestingModule.forRoot({
          langs: { es: { catalog: { addToCart: 'Agregar al carrito', soldOut: 'Agotado' } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      // `<app-price>` lee el tipo de cambio por HttpClient; sin respuesta queda en USD, que no afecta a estas pruebas.
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('producto', p);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, boton: (fixture.nativeElement as HTMLElement).querySelector('button')! };
  };

  it('agotado → botón deshabilitado con el texto "Agotado" (CA-4.2)', async () => {
    const { boton } = await crear(producto({ stock: 0 }));
    expect(boton.disabled).toBeTrue();
    expect(boton.textContent!.trim()).toBe('Agotado');
  });

  it('con stock el botón emite `agregar` con el producto', async () => {
    const { fixture, boton } = await crear(producto());
    const emitido = jasmine.createSpy('agregar');
    fixture.componentInstance.agregar.subscribe(emitido);
    boton.click();
    expect(emitido).toHaveBeenCalledOnceWith(jasmine.objectContaining({ sku: 'MOU-M170' }));
  });

  it('imagen + nombre son UN solo enlace a la ficha, con las zonas medibles (CA-3.4, CA-8.1)', async () => {
    const { el } = await crear(producto());
    const enlace = el.querySelector('a')!;
    expect(enlace.getAttribute('href')).toBe('/producto/MOU-M170');
    expect(enlace.querySelector('img')).toBeTruthy();
    expect(enlace.querySelector('h3')!.textContent).toContain('Mouse Logitech M170');
    expect(el.querySelector('[data-zone=tarjeta-producto]')).toBeTruthy();
    expect(el.querySelector('[data-zone=precio]')).toBeTruthy();
    expect(el.querySelector('img')!.getAttribute('width')).toBe('600');
  });
});
