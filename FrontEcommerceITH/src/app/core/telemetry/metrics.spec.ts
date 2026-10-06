import { clicsFrustracion, clicsMuertos, permanencia, puntajeSus, resumenPorTarea, tiempoHastaCta } from './metrics';
import { Evento } from './telemetry.models';

const ev = (e: Evento['e'], t: number, extra: Partial<Evento> = {}): Evento => ({ s: 'P01-v1', v: 'v1', r: '/', p: '/', e, t, ...extra });

describe('metrics', () => {
  it('puntajeSus (CA-5.4)', () => {
    expect(puntajeSus(Array(10).fill(3))).toBe(50);
    expect(puntajeSus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(puntajeSus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
  });

  it('la permanencia descuenta la pestaña oculta: 10 s con 3 s oculta → 7 s (CA-3.2)', () => {
    const eventos = [
      ev('page_enter', 0),
      ev('visibility', 2000, { d: { estado: 'hidden' } }),
      ev('visibility', 5000, { d: { estado: 'visible' } }),
      ev('page_leave', 10000),
    ];
    expect(permanencia(eventos).paginas['/']).toBe(7);
  });

  it('permanencia por zona', () => {
    const eventos = [ev('page_enter', 0), ev('zone_enter', 1000, { z: 'precio' }), ev('zone_leave', 3500, { z: 'precio' }), ev('page_leave', 5000)];
    expect(permanencia(eventos).zonas['/']['precio']).toBe(2.5);
  });

  it('tiempo hasta la primera interacción con cta-principal (CA-3.2)', () => {
    const eventos = [ev('page_enter', 0), ev('zone_enter', 1500, { z: 'cta-principal' }), ev('click', 2000, { z: 'cta-principal' })];
    expect(tiempoHastaCta(eventos)['/']).toBe(1.5);
  });

  it('clics de frustración: 3 en 900 ms y 10 px → 1; 2 → 0; 3 en 1500 ms → 0 (CA-3.3)', () => {
    const clic = (t: number, x: number) => ev('click', t, { x, y: 100 });
    expect(clicsFrustracion([clic(0, 100), clic(400, 105), clic(900, 110)])['/']).toBe(1);
    expect(clicsFrustracion([clic(0, 100), clic(400, 105)])['/']).toBeUndefined();
    expect(clicsFrustracion([clic(0, 100), clic(700, 105), clic(1500, 110)])['/']).toBeUndefined();
  });

  it('clics muertos (CA-3.3)', () => {
    expect(clicsMuertos([ev('click', 0, { d: { interactivo: false } }), ev('click', 1, { d: { interactivo: true } })])['/']).toBe(1);
  });

  it('resumen por tarea: tiempo, resultado, errores, clics y razón (CA-3.1)', () => {
    const eventos = [
      ev('task_start', 0, { k: 'T1' }),
      ev('click', 1000, { k: 'T1' }),
      ev('help_requested', 2000, { k: 'T1' }),
      ev('add_to_cart', 3000, { k: 'T1', d: { compatible: false } }),
      ev('click', 4000, { k: 'T1' }),
      ev('task_end', 30000, { d: { resultado: 'exito' } }),
    ];
    const [r] = resumenPorTarea(eventos, { T1: 4, T2: 0, T3: 0 });
    expect(r).toEqual({ tarea: 'T1', tiempoS: 30, resultado: 'exito', errores: 2, clics: 2, clicsIdeales: 4, razonClics: 0.5 });
    expect(resumenPorTarea(eventos, { T1: 0, T2: 0, T3: 0 })[0].razonClics).toBeNull();
  });
});
