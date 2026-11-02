import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLAVE_PREFERENCIAS, PREDETERMINADAS, PreferenciasA11yService, sanear } from './preferencias.service';

describe('sanear', () => {
  it('acepta solo valores conocidos y completa con los predeterminados', () => {
    expect(sanear({ tema: 'oscuro', texto: 'gigante', basura: 1 })).toEqual({ ...PREDETERMINADAS, tema: 'oscuro' });
    expect(sanear(null)).toEqual(PREDETERMINADAS);
    expect(sanear('texto')).toEqual(PREDETERMINADAS);
  });
});

describe('PreferenciasA11yService', () => {
  const html = document.documentElement;
  const limpiar = () => ['tema', 'contraste', 'texto', 'espaciado', 'movimiento'].forEach((k) => delete html.dataset[k]);

  beforeEach(() => {
    localStorage.clear();
    limpiar();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });
  afterEach(limpiar);

  it('sin elección propia se aplica el tema y el contraste del sistema, y el texto normal', () => {
    TestBed.inject(PreferenciasA11yService);
    TestBed.tick();
    expect(['claro', 'oscuro']).toContain(html.dataset['tema']!);
    expect(['normal', 'alto']).toContain(html.dataset['contraste']!);
    expect(html.dataset['texto']).toBe('normal');
    expect(html.dataset['movimiento']).toBe('sistema');
  });

  it('la elección propia manda, se aplica al instante y se recuerda', () => {
    const s = TestBed.inject(PreferenciasA11yService);
    s.elegir('tema', 'oscuro');
    s.elegir('contraste', 'alto');
    s.elegir('texto', 'muy-grande');
    s.elegir('movimiento', 'reducido');
    TestBed.tick();
    expect(html.dataset).toEqual(jasmine.objectContaining({ tema: 'oscuro', contraste: 'alto', texto: 'muy-grande', movimiento: 'reducido' }));
    expect(JSON.parse(localStorage.getItem('ts_' + CLAVE_PREFERENCIAS)!)).toEqual(jasmine.objectContaining({ tema: 'oscuro', texto: 'muy-grande' }));
  });

  it('restablecer vuelve a lo predeterminado y borra lo guardado', () => {
    const s = TestBed.inject(PreferenciasA11yService);
    s.elegir('tema', 'claro');
    s.restablecer();
    TestBed.tick();
    expect(s.prefs()).toEqual(PREDETERMINADAS);
    expect(localStorage.getItem('ts_' + CLAVE_PREFERENCIAS)).toBeNull();
  });
});
