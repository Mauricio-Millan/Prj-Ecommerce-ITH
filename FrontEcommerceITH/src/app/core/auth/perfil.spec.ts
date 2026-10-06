import { HttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { PerfilApi } from '../account/perfil.api';
import { localStore } from '../storage/local-store';
import { SessionApi } from './session.api';

describe('perfil de la cuenta (spec 006, T002)', () => {
  const limpiar = () => ['session', 'perfil_u-cliente1'].forEach((k) => localStore.remove(k));

  beforeEach(async () => {
    limpiar();
    const semilla = await (await fetch('data/seed/usuarios.json')).json();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: HttpClient, useValue: { get: () => of(semilla) } }] });
  });
  afterEach(limpiar);

  it('guardar el DNI de u-cliente1, cerrar sesión y volver a entrar: el DNI sigue', async () => {
    const session = TestBed.inject(SessionApi);
    await firstValueFrom(session.iniciarSesion('cliente1@gmail.com', '123456'));
    expect(session.usuario()?.dni).toBeNull();

    TestBed.inject(PerfilApi).guardarDni('u-cliente1', '87654321');
    expect(session.usuario()?.dni).toBe('87654321');
    expect(localStore.get<{ dni: string }>('perfil_u-cliente1')?.dni).toBe('87654321');

    session.cerrarSesion();
    await firstValueFrom(session.iniciarSesion('cliente1@gmail.com', '123456'));
    expect(session.usuario()?.dni).toBe('87654321');
  });

  it('el perfil guarda solo el medio de pago, nunca sus datos', () => {
    const perfil = TestBed.inject(PerfilApi);
    expect(perfil.ultimoMetodo('u-cliente1')).toBeNull();
    perfil.guardarUltimoMetodo('u-cliente1', 'yape');
    expect(perfil.ultimoMetodo('u-cliente1')).toBe('yape');
    expect(localStore.get('perfil_u-cliente1')).toEqual({ ultimoMetodo: 'yape' });
  });
});
