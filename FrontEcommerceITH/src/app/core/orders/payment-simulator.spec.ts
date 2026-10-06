import { firstValueFrom } from 'rxjs';
import { MetodoPago, ResultadoCobro } from './orders.models';
import { resultadoDePrueba, simular } from './payment-simulator';

describe('payment-simulator (CA-4.5)', () => {
  const casos: [MetodoPago, { numero?: string; codigo?: string }, ResultadoCobro][] = [
    ['tarjeta', { numero: '4111 1111 1111 1111' }, 'aprobado'],
    ['tarjeta', { numero: '4000 0000 0000 0002' }, 'rechazado'],
    ['tarjeta', { numero: '4000000000000119' }, 'sin_respuesta'],
    ['tarjeta', { numero: '5555 5555 5555 4444' }, 'aprobado'],
    ['yape', { codigo: '123456' }, 'aprobado'],
    ['yape', { codigo: '000000' }, 'rechazado'],
    ['yape', { codigo: '999999' }, 'sin_respuesta'],
    ['yape', { codigo: '482913' }, 'aprobado'],
  ];

  it('cada dato de prueba da su resultado', () => {
    for (const [metodo, dato, esperado] of casos) expect(resultadoDePrueba(metodo, dato)).withContext(JSON.stringify(dato)).toBe(esperado);
  });

  describe('con reloj simulado', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate();
    });
    afterEach(() => jasmine.clock().uninstall());

    it('responde a los 1.5 s con una referencia simulada', async () => {
      const resultado = firstValueFrom(simular('tarjeta', { numero: '4111111111111111' }));
      jasmine.clock().tick(1499);
      let listo = false;
      resultado.then(() => (listo = true));
      await Promise.resolve();
      expect(listo).toBeFalse();
      jasmine.clock().tick(2);
      const r = await resultado;
      expect(r.resultado).toBe('aprobado');
      expect(r.referencia).toMatch(/^SIM-/);
    });

    it('"sin respuesta" termina a los 10 s y no devuelve referencia', async () => {
      const resultado = firstValueFrom(simular('yape', { codigo: '999999' }));
      jasmine.clock().tick(9999);
      let listo = false;
      resultado.then(() => (listo = true));
      await Promise.resolve();
      expect(listo).toBeFalse();
      jasmine.clock().tick(2);
      expect(await resultado).toEqual({ resultado: 'sin_respuesta', referencia: null });
    });

    it('el resultado no contiene el dato recibido (no se registra, CA-4.6)', async () => {
      const resultado = firstValueFrom(simular('tarjeta', { numero: '4111111111111111' }));
      jasmine.clock().tick(1600);
      expect(JSON.stringify(await resultado)).not.toContain('4111');
    });
  });
});
