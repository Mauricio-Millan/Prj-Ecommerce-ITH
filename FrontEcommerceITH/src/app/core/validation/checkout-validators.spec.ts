import { FormControl } from '@angular/forms';
import { celularPe, codigoYape, cvv, dni, formatearTarjeta, marcaTarjeta, tarjetaLuhn, vencimiento } from './validators';

const c = (v: string) => new FormControl(v);

describe('validators del checkout', () => {
  it('celularPe: 9 dígitos que empiezan con 9', () => {
    expect(celularPe(c('987654321'))).toBeNull();
    expect(celularPe(c('887654321'))).toEqual({ celular: true });
    expect(celularPe(c('98765432'))).toEqual({ celular: true });
    expect(celularPe(c(''))).toBeNull();
  });

  it('dni, cvv y código de Yape', () => {
    expect(dni(c('12345678'))).toBeNull();
    expect(dni(c('1234567'))).toEqual({ dni: true });
    expect(cvv(c('123'))).toBeNull();
    expect(cvv(c('12'))).toEqual({ cvv: true });
    expect(codigoYape(c('123456'))).toBeNull();
    expect(codigoYape(c('12345a'))).toEqual({ codigoYape: true });
  });

  it('tarjetaLuhn: acepta con espacios y rechaza un dígito mal puesto', () => {
    expect(tarjetaLuhn(c('4111111111111111'))).toBeNull();
    expect(tarjetaLuhn(c('4111 1111 1111 1111'))).toBeNull();
    expect(tarjetaLuhn(c('4111111111111112'))).toEqual({ tarjeta: true });
    expect(tarjetaLuhn(c('4111'))).toEqual({ tarjeta: true });
  });

  it('vencimiento: formato, mes válido y no vencida (con reloj fijo)', () => {
    const v = vencimiento(() => new Date(2026, 9, 5)); // octubre de 2026
    expect(v(c('10/26'))).toBeNull();
    expect(v(c('01/27'))).toBeNull();
    expect(v(c('09/26'))).toEqual({ vencida: true });
    expect(v(c('12/25'))).toEqual({ vencida: true });
    expect(v(c('13/30'))).toEqual({ vencimiento: true });
    expect(v(c('1226'))).toEqual({ vencimiento: true });
  });

  it('marca y formato de la tarjeta', () => {
    expect(marcaTarjeta('4111 1111')).toBe('visa');
    expect(marcaTarjeta('5555')).toBe('mastercard');
    expect(marcaTarjeta('2223')).toBe('mastercard');
    expect(marcaTarjeta('3714')).toBe('amex');
    expect(marcaTarjeta('9999')).toBeNull();
    expect(formatearTarjeta('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(formatearTarjeta('41111')).toBe('4111 1');
  });
});
