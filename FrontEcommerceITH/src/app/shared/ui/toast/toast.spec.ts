import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';

describe('ToastService', () => {
  let toast: ToastService;
  const tick = (ms: number) => jasmine.clock().tick(ms);

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    toast = TestBed.inject(ToastService);
  });
  afterEach(() => jasmine.clock().uninstall());

  it('una acción se ejecuta una sola vez y el aviso desaparece (T022)', () => {
    const ejecutar = jasmine.createSpy('ejecutar');
    toast.show('cart.added', 'exito', [{ clave: 'cart.undo', ejecutar }]);
    const aviso = toast.avisos()[0];

    toast.usar(aviso, aviso.acciones[0]);
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(toast.avisos()).toEqual([]);
  });

  it('un aviso de 10 s con el foco dentro no se cierra, y al salir se reanuda (T044)', () => {
    toast.show('compat.warning', 'advertencia', [], undefined, { duracionMs: 10_000, pausarAlEnfocar: true });
    const id = toast.avisos()[0].id;

    tick(4000);
    toast.pausar(id);
    tick(60_000);
    expect(toast.avisos().length).toBe(1);

    toast.reanudar(id);
    tick(5900);
    expect(toast.avisos().length).toBe(1);
    tick(200);
    expect(toast.avisos()).toEqual([]);
  });

  it('un aviso normal vence a los 6 s aunque se intente pausar', () => {
    toast.show('cart.added');
    toast.pausar(toast.avisos()[0].id);
    tick(6001);
    expect(toast.avisos()).toEqual([]);
  });

  it('alIgnorar se llama si vence o se cierra, pero no si se usó una acción', () => {
    const ignorar = jasmine.createSpy('ignorar');
    toast.show('a', 'info', [], undefined, { alIgnorar: ignorar });
    tick(6001);
    expect(ignorar).toHaveBeenCalledTimes(1);

    toast.show('b', 'info', [{ clave: 'x', ejecutar: () => {} }], undefined, { alIgnorar: ignorar });
    const aviso = toast.avisos()[0];
    toast.usar(aviso, aviso.acciones[0]);
    tick(6001);
    expect(ignorar).toHaveBeenCalledTimes(1);

    toast.show('c', 'info', [], undefined, { alIgnorar: ignorar });
    toast.cerrar(toast.avisos()[0].id);
    expect(ignorar).toHaveBeenCalledTimes(2);
  });
});
