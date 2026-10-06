import { aCentimos, precioPenCentimos } from '../../../core/currency/money';
import { convertir, formatear } from './price';

const sinEspacioDuro = (s: string) => s.replace(/ /g, ' ');

describe('money.ts (céntimos enteros)', () => {
  it('redondea mitad hacia arriba por unidad (000 T102)', () => {
    expect(precioPenCentimos(12.9, 3.75)).toBe(4838); // 48.375 → 48.38
    expect(precioPenCentimos(129, 3.75)).toBe(48375);
    expect(precioPenCentimos(0.01, 3.7512)).toBe(4);
    expect(aCentimos(19.99)).toBe(1999);
  });
});

describe('<app-price> conversión y formato', () => {
  it('100 USD × 3.75 = S/ 375.00 (CA-3.8, CA-3.6)', () => {
    const { centimos, moneda } = convertir(100, 'PEN', 3.75);
    expect(sinEspacioDuro(formatear(centimos, moneda, 'es-PE'))).toBe('S/ 375.00');
  });

  it('sin tipo de cambio cae a USD (CA-3.5)', () => {
    const { centimos, moneda } = convertir(100, 'PEN', null);
    expect(moneda).toBe('USD');
    expect(formatear(centimos, moneda, 'en-US')).toBe('$100.00');
  });

  it('los soles llevan `S/` también en inglés (CA-3.1)', () => {
    expect(sinEspacioDuro(formatear(22463, 'PEN', 'en-US'))).toBe('S/ 224.63');
  });

  it('formatea con separadores del idioma y quechua como es-PE', () => {
    expect(formatear(125000, 'USD', 'en-US')).toBe('$1,250.00');
    expect(sinEspacioDuro(formatear(125000, 'PEN', 'qu-PE'))).toBe('S/ 1,250.00');
  });
});
