import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { invitadoGuard } from './invitado.guard';
import { authGuard } from './auth.guard';
import { SessionApi, Usuario } from './session.api';
import { NavigationHistory, rutaSegura } from './volver';

describe('rutaSegura (CA-1.7)', () => {
  it('acepta solo rutas internas', () => {
    expect(rutaSegura('/checkout')).toBe('/checkout');
    expect(rutaSegura('/catalogo/baterias?compat=1')).toBe('/catalogo/baterias?compat=1');
  });
  it('rechaza dominios externos, rutas relativas al protocolo y esquemas', () => {
    for (const mala of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/\\evil.com', '/a://b', 'checkout', '', null, undefined]) {
      expect(rutaSegura(mala)).withContext(String(mala)).toBeNull();
    }
  });
});

describe('NavigationHistory y guards de acceso', () => {
  const usuario = signal<Usuario | null>(null);

  beforeEach(() => {
    usuario.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', children: [] },
          { path: 'catalogo/:slug', children: [] },
          { path: 'auth/login', children: [] },
        ]),
        { provide: SessionApi, useValue: { usuario } },
      ],
    });
  });

  it('recuerda la última página que no es de /auth y destino() la usa; sin historial → inicio', async () => {
    const h = TestBed.inject(NavigationHistory);
    expect(h.destino(null)).toBe('/');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/catalogo/baterias?x=1');
    await router.navigateByUrl('/auth/login');
    expect(h.ultima()).toBe('/catalogo/baterias?x=1');
    expect(h.destino(null)).toBe('/catalogo/baterias?x=1');
    expect(h.destino('/checkout')).toBe('/checkout');
    expect(h.destino('https://evil.com')).toBe('/catalogo/baterias?x=1');
  });

  it('invitadoGuard: sin sesión deja pasar; con sesión redirige a volver o al inicio (CA-1.8)', () => {
    const ruta = (volver: string | null) => ({ queryParamMap: { get: () => volver } }) as never;
    const router = TestBed.inject(Router);
    TestBed.inject(NavigationHistory);

    expect(TestBed.runInInjectionContext(() => invitadoGuard(ruta('/checkout'), {} as never))).toBeTrue();
    usuario.set({ id: 'u', email: 'a@b.co', nombres: 'A', apellidos: 'B', dni: null, telefono: null, rol: 'cliente' });
    expect(router.serializeUrl(TestBed.runInInjectionContext(() => invitadoGuard(ruta('/checkout'), {} as never)) as never)).toBe('/checkout');
    expect(router.serializeUrl(TestBed.runInInjectionContext(() => invitadoGuard(ruta('//evil.com'), {} as never)) as never)).toBe('/');
  });

  it('authGuard: sin sesión manda al login con volver = la ruta pedida', () => {
    const router = TestBed.inject(Router);
    const r = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/checkout' } as never));
    expect(router.serializeUrl(r as never)).toBe('/auth/login?volver=%2Fcheckout');
  });
});
