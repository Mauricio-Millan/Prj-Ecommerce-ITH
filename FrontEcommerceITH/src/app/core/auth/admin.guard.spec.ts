import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast';
import { adminGuard } from './admin.guard';
import { SessionApi, Usuario } from './session.api';

describe('adminGuard (CA-1.4)', () => {
  const usuario = signal<Usuario | null>(null);
  const base = { id: 'u', email: 'u@x', nombres: 'U', apellidos: 'X', dni: null, telefono: null };
  const correr = () =>
    TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: SessionApi, useValue: { usuario } }],
    });
  });

  it('sin sesión redirige a la tienda y avisa', () => {
    usuario.set(null);
    const toast = spyOn(TestBed.inject(ToastService), 'show');
    const resultado = correr() as UrlTree;
    expect(resultado.toString()).toBe('/');
    expect(toast).toHaveBeenCalledWith('access.denied', 'advertencia');
  });

  it('con un cliente redirige', () => {
    usuario.set({ ...base, rol: 'cliente' });
    expect(correr() instanceof UrlTree).toBeTrue();
  });

  it('con sesión admin deja pasar', () => {
    usuario.set({ ...base, rol: 'admin' });
    expect(correr()).toBeTrue();
  });
});
