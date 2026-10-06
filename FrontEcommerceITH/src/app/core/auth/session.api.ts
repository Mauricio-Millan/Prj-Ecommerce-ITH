import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, map, of, switchMap } from 'rxjs';
import { localStore } from '../storage/local-store';
import { Perfil, escribirPerfil, leerPerfil } from './perfil';
import { sha256Hex } from './password';

export interface Usuario {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  dni: string | null;
  telefono: string | null;
  rol: 'cliente' | 'admin';
}

/** Formato de la semilla y de `ts_usuarios`: incluye el hash, que NUNCA se guarda en la sesión ni en el signal (spec 004). */
type Cuenta = Usuario & { password_sha256: string };

export interface DatosRegistro {
  nombres: string;
  apellidos: string;
  email: string;
  contrasena: string;
}

const KEY = 'session';
const KEY_USUARIOS = 'usuarios';

const sinHash = ({ password_sha256: _, ...usuario }: Cuenta): Usuario => usuario;
const normalizar = (email: string) => email.trim().toLowerCase();
const conPerfil = (u: Usuario | null): Usuario | null => {
  if (!u) return null;
  const { dni, telefono } = leerPerfil(u.id);
  return { ...u, ...(dni !== undefined && { dni }), ...(telefono !== undefined && { telefono }) };
};

/** Sesión simulada de la Fase 1: cuentas de prueba (`data/seed/usuarios.json`) + cuentas creadas (`ts_usuarios`). En la Fase 2, Supabase Auth. */
@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly http = inject(HttpClient);
  private readonly _usuario = signal<Usuario | null>(conPerfil(localStore.get<Usuario>(KEY)));
  readonly usuario = this._usuario.asReadonly();

  /** Superpone el perfil editable (DNI, celular) a los datos de la semilla (spec 006 § 1.1). */
  private entrar(usuario: Usuario): Usuario {
    const completo = conPerfil(usuario)!;
    this._usuario.set(completo);
    localStore.set(KEY, completo);
    return completo;
  }

  /** Cambios en el perfil de la cuenta con sesión (por ejemplo, el DNI que se pide en el checkout): se guardan y se ven al instante. */
  actualizarPerfil(cambios: Pick<Perfil, 'dni' | 'telefono'>): void {
    const actual = this._usuario();
    if (!actual) return;
    escribirPerfil(actual.id, cambios);
    this.entrar(actual);
  }

  private cuentas(): Observable<Cuenta[]> {
    return this.http.get<Cuenta[]>('data/seed/usuarios.json').pipe(map((semilla) => [...semilla, ...(localStore.get<Cuenta[]>(KEY_USUARIOS) ?? [])]));
  }

  /** Sin contraseña: solo lo usa el panel de investigador para preparar la sesión (004 plan § 1.3). */
  iniciarComo(email: string): Observable<Usuario | null> {
    return this.cuentas().pipe(
      map((cuentas) => cuentas.find((c) => c.email === normalizar(email))),
      map((cuenta) => (cuenta ? this.entrar(sinHash(cuenta)) : null)),
    );
  }

  /** `null` si el correo o la contraseña no coinciden: no se dice cuál de los dos falló (CA-1.5). */
  iniciarSesion(email: string, contrasena: string): Observable<Usuario | null> {
    return from(sha256Hex(contrasena)).pipe(
      switchMap((hash) => this.cuentas().pipe(map((cuentas) => cuentas.find((c) => c.email === normalizar(email) && c.password_sha256 === hash)))),
      map((cuenta) => (cuenta ? this.entrar(sinHash(cuenta)) : null)),
    );
  }

  /** Crea la cuenta e inicia sesión de inmediato (CA-2.5). `'correo_existente'` si el correo ya tiene cuenta (CA-2.4). */
  registrar(datos: DatosRegistro): Observable<Usuario | 'correo_existente'> {
    const email = normalizar(datos.email);
    return this.cuentas().pipe(
      switchMap((cuentas) => {
        if (cuentas.some((c) => c.email === email)) return of('correo_existente' as const);
        return from(sha256Hex(datos.contrasena)).pipe(
          map((password_sha256) => {
            const cuenta: Cuenta = {
              id: 'u-' + crypto.randomUUID(),
              email,
              nombres: datos.nombres.trim(),
              apellidos: datos.apellidos.trim(),
              dni: null,
              telefono: null,
              rol: 'cliente',
              password_sha256,
            };
            localStore.set(KEY_USUARIOS, [...(localStore.get<Cuenta[]>(KEY_USUARIOS) ?? []), cuenta]);
            return this.entrar(sinHash(cuenta));
          }),
        );
      }),
    );
  }

  cerrarSesion(): void {
    this._usuario.set(null);
    localStore.remove(KEY);
  }
}
