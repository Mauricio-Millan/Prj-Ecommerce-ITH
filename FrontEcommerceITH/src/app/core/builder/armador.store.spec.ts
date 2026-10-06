import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast';
import { CartApi } from '../cart/cart.api';
import { CatalogApi } from '../catalog/catalog.api';
import { Catalogo, Compatibilidad } from '../catalog/catalog.models';
import { CurrencyService } from '../currency/currency.service';
import { localStore } from '../storage/local-store';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { ArmadorStore } from './armador.store';

describe('ArmadorStore (spec 008)', () => {
  let cat: Catalogo;
  let compat: Compatibilidad;
  let eventos: { tipo: string; datos?: Record<string, unknown> }[];
  let agregadas: { sku: string; cantidad: number; stock: number }[][];
  const deshacer = jasmine.createSpy('deshacerUltimo');

  const configurar = () =>
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: { navigateByUrl: () => {} } },
        { provide: InteractionLogger, useValue: { track: (tipo: string, datos?: Record<string, unknown>) => eventos.push({ tipo, datos }) } },
        { provide: CurrencyService, useValue: { exchangeRate: () => ({ valor: '3.75', fecha: '2026-10-05' }) } },
        {
          provide: CartApi,
          useValue: {
            agregarVarios: (l: { sku: string; cantidad: number; stock: number }[]) => {
              agregadas.push(l);
              return { agregadas: l.length, limitado: false };
            },
            deshacerUltimo: deshacer,
          },
        },
        {
          provide: CatalogApi,
          useValue: {
            todos: () => of(cat.productos),
            categorias: () => of(cat.categorias),
            atributos: () => of(cat.atributos),
            reglas: () => of(compat.reglas_compatibilidad),
          },
        },
      ],
    });

  beforeAll(async () => {
    cat = await (await fetch('data/seed/catalogo.json')).json();
    compat = await (await fetch('data/seed/compatibilidad.json')).json();
  });
  beforeEach(() => {
    localStore.remove('armador');
    eventos = [];
    agregadas = [];
    deshacer.calls.reset();
    configurar();
  });
  afterEach(() => localStore.remove('armador'));

  const combo = (s: ArmadorStore) => {
    for (const [paso, sku] of [['cpu', 'CPU-R5-7600'], ['placa', 'MB-B650M'], ['ram', 'RAM-KF556-16'], ['gpu', 'GPU-RTX4060'], ['almacenamiento', 'SSD-NV2-1TB'], ['fuente', 'PSU-CV550'], ['case', 'CASE-Q300L']] as const) s.elegir(paso, sku);
    s.omitir('cooler');
  };

  it('elegir avanza al siguiente paso pendiente y registra builder_select con lo que reemplaza', () => {
    const s = TestBed.inject(ArmadorStore);
    s.elegir('cpu', 'CPU-R5-5600');
    expect(s.armado().pasoActual).toBe('placa');
    s.elegir('cpu', 'CPU-R5-7600');
    expect(eventos.filter((e) => e.tipo === 'builder_select').map((e) => e.datos)).toEqual([
      { paso: 'cpu', sku: 'CPU-R5-5600', reemplaza: null },
      { paso: 'cpu', sku: 'CPU-R5-7600', reemplaza: 'CPU-R5-5600' },
    ]);
  });

  it('cambiar el procesador con una placa AM4 elegida: se aplica, queda el conflicto y se emite builder_conflict con la causa', () => {
    const s = TestBed.inject(ArmadorStore);
    s.elegir('cpu', 'CPU-R5-5600');
    s.elegir('placa', 'MB-B550M');
    s.elegir('cpu', 'CPU-R5-7600');
    expect(s.armado().piezas['cpu']).toBe('CPU-R5-7600');
    expect(s.estado().conflictos.map((c) => c.afectado)).toEqual(['placa']);
    expect(eventos.find((e) => e.tipo === 'builder_conflict')?.datos).toEqual({ pasos: ['placa'], causa: 'cpu' });
  });

  it('omitir solo funciona en pasos opcionales; con el 5600 la tarjeta de video es obligatoria', () => {
    const s = TestBed.inject(ArmadorStore);
    s.elegir('cpu', 'CPU-R5-5600');
    s.omitir('gpu');
    expect(s.armado().piezas['gpu']).toBeUndefined();
    s.omitir('cooler');
    expect(s.armado().piezas['cooler']).toBe('omitido');
    s.elegir('cpu', 'CPU-R5-7600');
    s.omitir('gpu');
    expect(s.armado().piezas['gpu']).toBe('omitido');
  });

  it('recargar conserva el armado, el presupuesto y el paso (CA-6.1)', () => {
    const s = TestBed.inject(ArmadorStore);
    s.elegir('cpu', 'CPU-R5-7600');
    s.fijarPresupuesto(337500);
    TestBed.resetTestingModule();
    configurar();
    const otra = TestBed.inject(ArmadorStore);
    expect([otra.armado().piezas['cpu'], otra.armado().presupuestoCentimos, otra.armado().pasoActual]).toEqual(['CPU-R5-7600', 337500, 'placa']);
  });

  it('no se puede enviar al carrito un armado incompleto', () => {
    const s = TestBed.inject(ArmadorStore);
    s.elegir('cpu', 'CPU-R5-7600');
    s.enviarAlCarrito();
    expect(agregadas).toEqual([]);
  });

  it('enviarAlCarrito agrega las 7 piezas en una operación, avisa con un solo "Deshacer", emite builder_complete y vacía el armado', () => {
    const s = TestBed.inject(ArmadorStore);
    combo(s);
    s.fijarPresupuesto(337500);
    expect(s.estado().completo).toBeTrue();

    s.enviarAlCarrito();
    expect(agregadas.length).toBe(1);
    expect(agregadas[0].map((l) => l.sku).sort()).toEqual(['CASE-Q300L', 'CPU-R5-7600', 'GPU-RTX4060', 'MB-B650M', 'PSU-CV550', 'RAM-KF556-16', 'SSD-NV2-1TB']);
    expect(agregadas[0].every((l) => l.cantidad === 1)).toBeTrue();

    const aviso = TestBed.inject(ToastService).avisos()[0];
    expect([aviso.clave, aviso.params]).toEqual(['cart.batch', { n: 7 }]);
    expect(eventos.find((e) => e.tipo === 'builder_complete')?.datos).toEqual({ piezas: 7, total_pen: 331875, presupuesto_pen: 337500, dentro_presupuesto: true });
    expect(s.armado().piezas).toEqual({});
    expect(s.enviado()).toBeTrue();
    expect(localStore.get<{ piezas: object }>('armador')?.piezas).toEqual({});

    TestBed.inject(ToastService).usar(aviso, aviso.acciones.find((a) => a.clave === 'cart.undo')!);
    expect(deshacer).toHaveBeenCalledTimes(1);
    expect(eventos.some((e) => e.tipo === 'undo' && e.datos?.['accion'] === 'armado')).toBeTrue();
  });

  it('reiniciar vacía el armado; costoDe da el "+S/ X" y lo que quedaría del presupuesto', () => {
    const s = TestBed.inject(ArmadorStore);
    s.fijarPresupuesto(100000);
    s.elegir('cpu', 'CPU-R5-5600');
    const cpu7600 = cat.productos.find((p) => p.sku === 'CPU-R5-7600')!;
    expect(s.costoDe(cpu7600, 'cpu')).toEqual({ incremento: 74625 - 48375, quedaria: 100000 - 48375 - (74625 - 48375) });
    s.reiniciar();
    expect(s.armado().piezas).toEqual({});
    expect(s.armado().pasoActual).toBe('cpu');
  });
});
