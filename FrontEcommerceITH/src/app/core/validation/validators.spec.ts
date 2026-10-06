import { FormControl } from '@angular/forms';
import { contrasenaSegura, correo, requisitosContrasena } from './validators';

describe('validators de la cuenta', () => {
  it('correo: "a@b" falla, "ana@gmail.com" pasa y el vacío lo resuelve required', () => {
    expect(correo(new FormControl('a@b'))).toEqual({ correo: true });
    expect(correo(new FormControl('ana gmail.com'))).toEqual({ correo: true });
    expect(correo(new FormControl('ana@gmail.com'))).toBeNull();
    expect(correo(new FormControl(' ana@gmail.com '))).toBeNull();
    expect(correo(new FormControl(''))).toBeNull();
  });

  it('requisitosContrasena marca cada requisito por separado', () => {
    expect(requisitosContrasena('abc')).toEqual({ largo: false, letra: true, numero: false });
    expect(requisitosContrasena('12345678')).toEqual({ largo: true, letra: false, numero: true });
    expect(requisitosContrasena('clave2026')).toEqual({ largo: true, letra: true, numero: true });
  });

  it('contrasenaSegura: "clave2026" pasa; "clave" y "12345678" fallan diciendo qué falta', () => {
    expect(contrasenaSegura(new FormControl('clave2026'))).toBeNull();
    expect(contrasenaSegura(new FormControl('clave'))).toEqual({ contrasena: { largo: false, letra: true, numero: false } });
    expect(contrasenaSegura(new FormControl('12345678'))?.['contrasena']).toEqual({ largo: true, letra: false, numero: true });
  });
});
