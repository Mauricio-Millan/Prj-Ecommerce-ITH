import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { localStore } from '../storage/local-store';
import { InteractionLogger, claveEventos } from './interaction-logger';
import { SessionRecorder } from './session-recorder';

describe('SessionRecorder', () => {
  let rec: SessionRecorder;

  beforeEach(() => {
    localStore.remove('research_session');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    rec = TestBed.inject(SessionRecorder);
  });

  afterEach(() => {
    if (rec.tareaActual()) rec.terminarTarea('abandono');
    rec.cerrarSesion();
    localStore.remove(claveEventos('P03-v1'));
  });

  it('rechaza nombres y códigos mal formados; acepta P03 (CA-1.2)', () => {
    expect(rec.iniciarSesion('Juan', 'v1')).toBe('research.error.participante');
    expect(rec.iniciarSesion('P1', 'v1')).toBe('research.error.participante');
    expect(rec.iniciarSesion('P03', 'version1')).toBe('research.error.version');
    expect(rec.sesion()).toBeNull();
    expect(rec.iniciarSesion('p03', 'V1')).toBeNull();
    expect(rec.sesion()?.id).toBe('P03-v1');
  });

  it('no permite dos tareas abiertas (CA-1.4)', () => {
    rec.iniciarSesion('P03', 'v1');
    expect(rec.iniciarTarea('T1')).toBeTrue();
    expect(rec.iniciarTarea('T2')).toBeFalse();
    rec.terminarTarea('exito');
    expect(rec.iniciarTarea('T2')).toBeTrue();
  });

  it('"Ayuda solicitada" sin tarea abierta no registra nada; con tarea, sí (CA-1.5)', () => {
    rec.iniciarSesion('P03', 'v1');
    const logger = TestBed.inject(InteractionLogger);
    const ayudas = () => logger.eventos().filter((e) => e.e === 'help_requested').length;
    rec.ayudaSolicitada();
    expect(ayudas()).toBe(0);
    rec.iniciarTarea('T1');
    rec.ayudaSolicitada();
    expect(ayudas()).toBe(1);
  });
});
