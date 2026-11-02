import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Type, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { violacionesGraves } from '../testing/axe';
import { GTM_ID_TOKEN } from './core/analytics/analytics';
import Accesibilidad from './pages/accesibilidad/accesibilidad';
import Ayuda from './pages/ayuda/ayuda';
import { A11yPanel } from './shared/ui/a11y-panel/a11y-panel';
import { FieldError } from './shared/ui/field-error/field-error';
import Dashboard from './pages/admin/dashboard/dashboard';
import EquiposAdmin from './pages/admin/equipos/equipos';
import ProductoForm from './pages/admin/producto-form/producto-form';
import ProductosAdmin from './pages/admin/productos/productos';
import TipoCambioAdmin from './pages/admin/tipo-cambio/tipo-cambio';
import { ScannerDialog } from './shared/ui/scanner-dialog/scanner-dialog';
import { Stepper } from './shared/ui/stepper/stepper';

/** Spec 018 CA-7.3: sin violaciones críticas ni serias de axe en las piezas y pantallas nuevas o clave. */
describe('Accesibilidad automática (axe-core)', () => {
  const montar = async (componente: Type<unknown>, entradas: Record<string, unknown> = {}) => {
    TestBed.configureTestingModule({
      imports: [componente],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({ config: { availableLangs: ['es-PE'], defaultLang: 'es-PE' } }),
        { provide: GTM_ID_TOKEN, useValue: '' },
        { provide: DialogRef, useValue: { close: () => undefined, closed: { subscribe: () => undefined } } },
        { provide: DIALOG_DATA, useValue: { origen: 'buscador' } },
      ],
    });
    const fixture = TestBed.createComponent(componente);
    for (const [k, v] of Object.entries(entradas)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('el panel de preferencias de accesibilidad', async () => {
    expect(await violacionesGraves(await montar(A11yPanel))).toEqual([]);
  });

  it('la página de ayuda y la declaración de accesibilidad', async () => {
    expect(await violacionesGraves(await montar(Ayuda))).toEqual([]);
    TestBed.resetTestingModule();
    expect(await violacionesGraves(await montar(Accesibilidad))).toEqual([]);
  });

  it('el diálogo de escaneo de códigos (spec 014)', async () => {
    expect(await violacionesGraves(await montar(ScannerDialog))).toEqual([]);
  });

  it('el backoffice: resumen, productos, formulario, equipos y tipo de cambio (spec 009)', async () => {
    for (const c of [Dashboard, ProductosAdmin, ProductoForm, EquiposAdmin, TipoCambioAdmin]) {
      expect(await violacionesGraves(await montar(c))).withContext(c.name).toEqual([]);
      TestBed.resetTestingModule();
    }
  });

  it('el mensaje de error de un campo y el stepper', async () => {
    expect(await violacionesGraves(await montar(FieldError, { errorId: 'x-error', codigo: 'required', campo: 'numero' }))).toEqual([]);
    TestBed.resetTestingModule();
    expect(await violacionesGraves(await montar(Stepper, { pasos: [{ clave: 'a' }, { clave: 'b' }], actual: 1 }))).toEqual([]);
  });
});
