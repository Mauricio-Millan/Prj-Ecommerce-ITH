import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Validadores de Reactive Forms reutilizables (los usan la 004 y la 006). El código del error es la clave `validation.<codigo>`. */

/** Más estricto que `Validators.email`, que acepta `a@b`. Un campo vacío lo resuelve `Validators.required`. */
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function correo(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').trim();
  return v === '' || RE_CORREO.test(v) ? null : { correo: true };
}

export interface RequisitosContrasena {
  largo: boolean;
  letra: boolean;
  numero: boolean;
}

/** Función pura: la usan el validador y la lista de requisitos en tiempo real (CA-2.2). */
export const requisitosContrasena = (valor: string): RequisitosContrasena => ({
  largo: valor.length >= 8,
  letra: /\p{L}/u.test(valor),
  numero: /\d/.test(valor),
});

// ───────────── checkout (spec 006 § 4) ─────────────

const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const vacio = (c: AbstractControl) => String(c.value ?? '').trim() === '';

/** 9 dígitos que empiezan con 9. Un campo vacío lo resuelve `Validators.required`. */
export const celularPe = (c: AbstractControl): ValidationErrors | null => (vacio(c) || /^9\d{8}$/.test(String(c.value).trim()) ? null : { celular: true });

export const dni = (c: AbstractControl): ValidationErrors | null => (vacio(c) || /^\d{8}$/.test(String(c.value).trim()) ? null : { dni: true });

export const cvv = (c: AbstractControl): ValidationErrors | null => (vacio(c) || /^\d{3}$/.test(String(c.value).trim()) ? null : { cvv: true });

export const codigoYape = (c: AbstractControl): ValidationErrors | null => (vacio(c) || /^\d{6}$/.test(String(c.value).trim()) ? null : { codigoYape: true });

/** Algoritmo de Luhn sobre los dígitos. */
export function luhn(digitos: string): boolean {
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

/** 13 a 19 dígitos y Luhn; los espacios se ignoran. */
export function tarjetaLuhn(c: AbstractControl): ValidationErrors | null {
  if (vacio(c)) return null;
  const d = soloDigitos(c.value);
  return d.length >= 13 && d.length <= 19 && luhn(d) ? null : { tarjeta: true };
}

/** `MM/AA`, mes 01–12 y no anterior al mes actual. `ahora` solo se cambia en las pruebas. */
export const vencimiento =
  (ahora: () => Date = () => new Date()) =>
  (c: AbstractControl): ValidationErrors | null => {
    if (vacio(c)) return null;
    const m = /^(\d{2})\/(\d{2})$/.exec(String(c.value).trim());
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { vencimiento: true };
    const hoy = ahora();
    const anio = 2000 + Number(m[2]);
    return anio < hoy.getFullYear() || (anio === hoy.getFullYear() && Number(m[1]) < hoy.getMonth() + 1) ? { vencida: true } : null;
  };

export type MarcaTarjeta = 'visa' | 'mastercard' | 'amex' | null;

/** Marca por prefijo: Visa `4`, Mastercard `51–55` / `2221–2720`, Amex `34` / `37`. */
export function marcaTarjeta(numero: string): MarcaTarjeta {
  const d = soloDigitos(numero);
  const dos = Number(d.slice(0, 2));
  const cuatro = Number(d.slice(0, 4));
  if (d.startsWith('4')) return 'visa';
  if ((dos >= 51 && dos <= 55) || (cuatro >= 2221 && cuatro <= 2720)) return 'mastercard';
  if (dos === 34 || dos === 37) return 'amex';
  return null;
}

/** Grupos de 4 mientras se escribe, como en el plástico. */
export const formatearTarjeta = (numero: string): string => soloDigitos(numero).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

/** Devuelve qué requisitos faltan: `{ contrasena: { largo, letra, numero } }` (cada uno `true` si se cumple). */
export function contrasenaSegura(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '');
  if (v === '') return null;
  const r = requisitosContrasena(v);
  return r.largo && r.letra && r.numero ? null : { contrasena: r };
}
