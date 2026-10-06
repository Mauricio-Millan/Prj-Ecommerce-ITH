import { Catalogo, Compatibilidad, Producto } from '../catalog/catalog.models';
import { Armado, OMITIDO } from './builder.models';
import { ContextoArmador, candidatas, conflictos, disponibilidad, estado, evaluarCandidata, obligatorio, pasoDeConflicto, piezasRelacionadas, siguientePendiente } from './builder.logic';
import { PasoId } from './pasos';

/** Plan § 9: la prueba principal de la spec 008, con los datos reales (`catalogo.json` y las reglas de `compatibilidad.json`). */
describe('builder.logic (datos reales)', () => {
  let ctx: ContextoArmador;
  let cat: Catalogo;

  beforeAll(async () => {
    cat = await (await fetch('data/seed/catalogo.json')).json();
    const compat: Compatibilidad = await (await fetch('data/seed/compatibilidad.json')).json();
    ctx = { productos: cat.productos, categorias: cat.categorias, reglas: compat.reglas_compatibilidad };
  });

  const armado = (piezas: Partial<Record<PasoId, string>>, presupuestoCentimos: number | null = null): Armado => ({ piezas, presupuestoCentimos, pasoActual: 'cpu' });
  const compatibles = (paso: PasoId, a: Armado) => candidatas(paso, a, ctx).filter((c) => c.evaluacion.compatible).map((c) => c.producto.sku);

  const COMBO_AM5: Partial<Record<PasoId, string>> = {
    cpu: 'CPU-R5-7600', placa: 'MB-B650M', ram: 'RAM-KF556-16', gpu: 'GPU-RTX4060', almacenamiento: 'SSD-NV2-1TB', fuente: 'PSU-CV550', case: 'CASE-Q300L', cooler: OMITIDO,
  };

  describe('compatibilidad por paso', () => {
    it('con el Ryzen 5 7600 (AM5) solo calza la B650M; con la B650M, solo la RAM DDR5', () => {
      expect(compatibles('placa', armado({ cpu: 'CPU-R5-7600' }))).toEqual(['MB-B650M']);
      expect(compatibles('ram', armado({ cpu: 'CPU-R5-7600', placa: 'MB-B650M' }))).toEqual(['RAM-KF556-16']);
    });

    it('con el Ryzen 5 5600 (AM4): placa B550M y RAM DDR4', () => {
      expect(compatibles('placa', armado({ cpu: 'CPU-R5-5600' }))).toEqual(['MB-B550M']);
      expect(compatibles('ram', armado({ placa: 'MB-B550M' }))).toEqual(['RAM-KF432-16']);
    });

    it('el case mATX calza con las dos placas y el disipador AM4/AM5 con los dos procesadores', () => {
      for (const placa of ['MB-B550M', 'MB-B650M']) expect(evaluarCandidata('CASE-Q300L', 'case', armado({ placa }), ctx).compatible).toBeTrue();
      for (const cpu of ['CPU-R5-5600', 'CPU-R5-7600']) expect(evaluarCandidata('COOL-H212', 'cooler', armado({ cpu }), ctx).compatible).toBeTrue();
    });

    it('una no compatible trae su motivo (socket AM4 contra un procesador AM5)', () => {
      const e = evaluarCandidata('MB-B550M', 'placa', armado({ cpu: 'CPU-R5-7600' }), ctx);
      expect(e.compatible).toBeFalse();
      expect(e.motivos[0]).toEqual(jasmine.objectContaining({ mensaje: 'builder.conflict.socket', otroPaso: 'cpu', esta: 'AM4', otra: 'AM5' }));
    });

    it('sin piezas elegidas todo es compatible, y se muestran las relacionadas con el paso', () => {
      expect(compatibles('placa', armado({}))).toEqual(['MB-B550M', 'MB-B650M']);
      expect(piezasRelacionadas('placa', armado({ cpu: 'CPU-R5-7600', gpu: 'GPU-RTX4060' }), ctx).map((p) => p.sku)).toEqual(['CPU-R5-7600']);
    });
  });

  describe('conflictos al cambiar una pieza anterior (CA-4.1)', () => {
    it('cambiar el procesador de AM4 a AM5 marca la placa; al reemplazarla, aparece la RAM DDR4; al reemplazar la RAM no queda ninguno', () => {
      const am4 = armado({ cpu: 'CPU-R5-5600', placa: 'MB-B550M', ram: 'RAM-KF432-16' });
      expect(conflictos(am4, ctx)).toEqual([]);

      const cambiado = armado({ ...am4.piezas, cpu: 'CPU-R5-7600' });
      const c1 = conflictos(cambiado, ctx);
      expect(c1.map((c) => [c.reglaId, c.afectado])).toEqual([[1, 'placa']]);
      expect(pasoDeConflicto(cambiado, ctx)).toBe('placa');

      const conPlaca = armado({ ...cambiado.piezas, placa: 'MB-B650M' });
      expect(conflictos(conPlaca, ctx).map((c) => c.afectado)).toEqual(['ram']);
      expect(conflictos(armado({ ...conPlaca.piezas, ram: 'RAM-KF556-16' }), ctx)).toEqual([]);
    });
  });

  describe('obligatoriedad (CA-1.2)', () => {
    it('la GPU es obligatoria con el 5600 (sin gráficos integrados) y opcional con el 7600', () => {
      expect(obligatorio('gpu', armado({ cpu: 'CPU-R5-5600' }), ctx)).toEqual({ obligatorio: true, motivo: 'sin_igpu' });
      expect(obligatorio('gpu', armado({ cpu: 'CPU-R5-7600' }), ctx)).toEqual({ obligatorio: false, motivo: 'con_igpu' });
      expect(obligatorio('gpu', armado({}), ctx).obligatorio).toBeTrue();
    });

    it('el cooler es opcional con ambos procesadores (traen disipador); los demás pasos siempre son obligatorios', () => {
      for (const cpu of ['CPU-R5-5600', 'CPU-R5-7600']) expect(obligatorio('cooler', armado({ cpu }), ctx)).toEqual({ obligatorio: false, motivo: 'con_disipador' });
      for (const p of ['cpu', 'placa', 'ram', 'almacenamiento', 'fuente', 'case'] as PasoId[]) expect(obligatorio(p, armado({ cpu: 'CPU-R5-7600' }), ctx).obligatorio).toBeTrue();
    });
  });

  describe('potencia', () => {
    it('7600 (65 W) + RTX 4060 (115 W) + 100 W = 280 W, y la fuente de 550 W alcanza', () => {
      const a = armado({ cpu: 'CPU-R5-7600', gpu: 'GPU-RTX4060', fuente: 'PSU-CV550' });
      const e = estado(a, ctx, 3.75);
      expect([e.consumoW, e.potenciaW]).toEqual([280, 550]);
      expect(conflictos(a, ctx)).toEqual([]);
    });

    it('una fuente ficticia de 250 W produce un conflicto de potencia en la fuente', () => {
      const fuente250 = { ...cat.productos.find((p) => p.sku === 'PSU-CV550')!, sku: 'PSU-250', especificaciones: { potencia_w: 250 } } as Producto;
      const ctx2 = { ...ctx, productos: [...ctx.productos, fuente250] };
      const a = armado({ cpu: 'CPU-R5-7600', gpu: 'GPU-RTX4060', fuente: 'PSU-250' });
      const c = conflictos(a, ctx2);
      expect(c.map((x) => [x.reglaId, x.afectado])).toEqual([[6, 'fuente']]);
      expect(c[0].motivo).toEqual(jasmine.objectContaining({ consumoW: 280, potenciaW: 250 }));
    });

    it('al elegir la tarjeta de video se tiene en cuenta contra la fuente ya elegida', () => {
      expect(evaluarCandidata('GPU-RTX4060', 'gpu', armado({ cpu: 'CPU-R5-7600', fuente: 'PSU-CV550' }), ctx).compatible).toBeTrue();
    });
  });

  describe('total y presupuesto (T3)', () => {
    it('el combo AM5 suma 331875 céntimos y está completo (el cooler se omite)', () => {
      const e = estado(armado(COMBO_AM5), ctx, 3.75);
      expect(e.totalCentimos).toBe(331875);
      expect([e.faltantes, e.conflictos, e.noDisponibles, e.completo]).toEqual([[], [], [], true]);
    });

    it('con presupuesto de 337500 te quedan 5625; con la fuente de 650 W el total es 340875 y te pasas por 3375 (no bloquea)', () => {
      expect(estado(armado(COMBO_AM5, 337500), ctx, 3.75).restanteCentimos).toBe(5625);
      const e = estado(armado({ ...COMBO_AM5, fuente: 'PSU-RM650E' }, 337500), ctx, 3.75);
      expect([e.totalCentimos, e.restanteCentimos, e.completo]).toEqual([340875, -3375, true]);
    });

    it('sin presupuesto no hay restante; sin tipo de cambio el total queda en USD de referencia', () => {
      expect(estado(armado(COMBO_AM5), ctx, 3.75).restanteCentimos).toBeNull();
      expect(estado(armado(COMBO_AM5), ctx, null).totalCentimos).toBe(88500);
    });

    it('faltan las piezas obligatorias sin elegir', () => {
      expect(estado(armado({ cpu: 'CPU-R5-5600' }), ctx, 3.75).faltantes).toEqual(['placa', 'ram', 'gpu', 'almacenamiento', 'fuente', 'case']);
    });
  });

  describe('disponibilidad (CA-2.4, 6.3)', () => {
    it('la RX 7600 (agotada) se lista pero con stock 0, después de las disponibles', () => {
      const lista = candidatas('gpu', armado({}), ctx).map((c) => [c.producto.sku, c.producto.stock > 0]);
      expect(lista).toEqual([['GPU-RTX4060', true], ['GPU-RX7600', false]]);
    });

    it('una pieza elegida que se agota o desaparece deja el armado incompleto', () => {
      const a = armado(COMBO_AM5);
      const agotada = { ...ctx, productos: ctx.productos.map((p) => (p.sku === 'MB-B650M' ? { ...p, stock: 0 } : p)) };
      expect(disponibilidad(a, agotada)).toEqual(['placa']);
      expect(estado(a, agotada, 3.75).completo).toBeFalse();
      expect(pasoDeConflicto(a, agotada)).toBe('placa');

      const inexistente = { ...ctx, productos: ctx.productos.filter((p) => p.sku !== 'CASE-Q300L') };
      expect(disponibilidad(a, inexistente)).toEqual(['case']);
    });
  });

  describe('siguientePendiente (CA-1.5)', () => {
    it('después de elegir la CPU va a la placa; si todo está elegido u omitido, al resumen', () => {
      expect(siguientePendiente('cpu', armado({ cpu: 'CPU-R5-7600' }))).toBe('placa');
      expect(siguientePendiente('cooler', armado(COMBO_AM5))).toBe('resumen');
    });

    it('salta lo ya resuelto y vuelve al principio si quedó algo atrás', () => {
      expect(siguientePendiente('placa', armado({ placa: 'MB-B650M', ram: 'RAM-KF556-16' }))).toBe('gpu');
      expect(siguientePendiente('cooler', armado({ ...COMBO_AM5, cpu: undefined }))).toBe('cpu');
    });
  });
});
