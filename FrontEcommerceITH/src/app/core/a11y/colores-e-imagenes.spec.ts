import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ImgFallback } from '../../shared/ui/img-fallback/img-fallback';
import { PREDETERMINADAS, sanear } from './preferencias.service';

describe('Colores seguros para daltonismo (spec 018, HU-11)', () => {
  it('por defecto los colores son normales y solo se acepta un valor conocido', () => {
    expect(PREDETERMINADAS.colores).toBe('normal');
    expect(sanear({ colores: 'seguros' }).colores).toBe('seguros');
    expect(sanear({ colores: 'rojo' }).colores).toBe('normal');
    expect(sanear(null).colores).toBe('normal');
  });
});

@Component({ imports: [ImgFallback], template: `<img src="no-existe.webp" alt="" [appImgFallback]="'Mouse Logitech M170'" />` })
class Anfitrion {}

describe('ImgFallback (spec 018, CA-1.7)', () => {
  const montar = () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    return f.nativeElement.querySelector('img') as HTMLImageElement;
  };

  it('si la imagen falla, muestra su texto alternativo y marca la imagen', () => {
    const img = montar();
    img.dispatchEvent(new Event('error'));
    expect(img.alt).toBe('Mouse Logitech M170');
    expect(img.classList).toContain('img-rota');
  });

  it('si luego carga bien, vuelve a su estado normal', () => {
    const img = montar();
    img.dispatchEvent(new Event('error'));
    img.dispatchEvent(new Event('load'));
    expect(img.alt).toBe('');
    expect(img.classList).not.toContain('img-rota');
  });
});
