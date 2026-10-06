import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { localStore } from '../storage/local-store';
import { sha256Hex } from './password';
import { SessionApi } from './session.api';

describe('sha256Hex', () => {
  it('"123456" da el hash de las cuentas de prueba', async () => {
    expect(await sha256Hex('123456')).toBe('8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
  });
});

describe('SessionApi.iniciarComo', () => {
  afterEach(() => localStore.remove('session'));

  it('nunca guarda el hash de la contraseña en la sesión ni en el signal (spec 004)', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(SessionApi);
    api.iniciarComo(' Cliente1@gmail.com ').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('data/seed/usuarios.json')
      .flush([{ id: 'u-cliente1', email: 'cliente1@gmail.com', password_sha256: 'abc', nombres: 'Ana', apellidos: 'T', dni: null, telefono: null, rol: 'cliente' }]);

    expect(api.usuario()?.nombres).toBe('Ana');
    expect('password_sha256' in api.usuario()!).toBeFalse();
    expect(JSON.stringify(localStore.get('session'))).not.toContain('abc');
  });
});

/** Plan § 9, con las cuentas de prueba reales (`usuarios.json`). */
describe('SessionApi: iniciar sesión y registrar', () => {
  let api: SessionApi;

  beforeEach(async () => {
    localStore.remove('session');
    localStore.remove('usuarios');
    const semilla = await (await fetch('data/seed/usuarios.json')).json();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: HttpClient, useValue: { get: () => of(semilla) } }] });
    api = TestBed.inject(SessionApi);
  });
  afterEach(() => {
    localStore.remove('session');
    localStore.remove('usuarios');
  });

  it('el correo con mayúsculas y espacios entra, y la sesión no guarda el hash', async () => {
    const u = await firstValueFrom(api.iniciarSesion(' CLIENTE1@gmail.com ', '123456'));
    expect(u?.nombres).toBe('Ana');
    expect(api.usuario()?.email).toBe('cliente1@gmail.com');
    expect(JSON.stringify(localStore.get('session'))).not.toContain('password');
    expect(JSON.stringify(localStore.get('session'))).not.toContain('8d969eef');
  });

  it('contraseña incorrecta o correo inexistente → null, sin sesión (no dice cuál falló)', async () => {
    expect(await firstValueFrom(api.iniciarSesion('cliente1@gmail.com', 'otra'))).toBeNull();
    expect(await firstValueFrom(api.iniciarSesion('nadie@gmail.com', '123456'))).toBeNull();
    expect(api.usuario()).toBeNull();
  });

  it('registrar con un correo de la semilla → correo_existente (sin importar mayúsculas)', async () => {
    const r = await firstValueFrom(api.registrar({ nombres: 'X', apellidos: 'Y', email: 'Cliente2@gmail.com', contrasena: 'clave2026' }));
    expect(r).toBe('correo_existente');
    expect(api.usuario()).toBeNull();
  });

  it('registrar un correo nuevo crea la cuenta (con hash, sin DNI) e inicia sesión; luego se puede entrar de nuevo', async () => {
    const r = await firstValueFrom(api.registrar({ nombres: ' Luis ', apellidos: 'Rojas', email: 'luis@gmail.com', contrasena: 'clave2026' }));
    expect(typeof r).toBe('object');
    expect(api.usuario()).toEqual(jasmine.objectContaining({ email: 'luis@gmail.com', nombres: 'Luis', rol: 'cliente', dni: null }));
    expect('password_sha256' in api.usuario()!).toBeFalse();
    expect(localStore.get<{ email: string; password_sha256: string }[]>('usuarios')![0].password_sha256).toBe(await sha256Hex('clave2026'));

    api.cerrarSesion();
    expect((await firstValueFrom(api.iniciarSesion('luis@gmail.com', 'clave2026')))?.nombres).toBe('Luis');
    expect(await firstValueFrom(api.registrar({ nombres: 'L', apellidos: 'R', email: 'LUIS@gmail.com', contrasena: 'clave2026' }))).toBe('correo_existente');
  });
});
