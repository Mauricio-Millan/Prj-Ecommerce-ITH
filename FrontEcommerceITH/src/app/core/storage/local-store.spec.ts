import { localStore } from './local-store';

describe('localStore', () => {
  afterEach(() => localStorage.removeItem('ts_prueba'));

  it('guarda con el prefijo ts_ y lee el mismo valor', () => {
    expect(localStore.set('prueba', { a: 1 })).toBeTrue();
    expect(localStorage.getItem('ts_prueba')).toBe('{"a":1}');
    expect(localStore.get('prueba')).toEqual({ a: 1 });
  });

  it('no propaga errores si localStorage falla (navegación privada, cuota llena)', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('SecurityError');
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    expect(localStore.get('prueba')).toBeNull();
    expect(localStore.set('prueba', 1)).toBeFalse();
  });

  it('devuelve null si el contenido guardado no es JSON', () => {
    localStorage.setItem('ts_prueba', '{roto');
    expect(localStore.get('prueba')).toBeNull();
  });
});
