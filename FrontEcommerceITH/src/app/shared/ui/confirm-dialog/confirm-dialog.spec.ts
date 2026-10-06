import { Dialog } from '@angular/cdk/dialog';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog (T020)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTransloco({ config: { availableLangs: ['es-PE'], defaultLang: 'es-PE' } })],
    }),
  );
  afterEach(() => TestBed.inject(Dialog).closeAll());

  const abrir = () =>
    TestBed.inject(Dialog).open<boolean>(ConfirmDialog, {
      data: { tituloClave: 'cart.clearTitle', mensajeClave: 'cart.clearBody', params: { n: 2 }, confirmarClave: 'cart.clearConfirm' },
      autoFocus: '[data-cancelar]',
    });

  it('es el modal catalogado y el foco empieza en "Cancelar"', async () => {
    abrir();
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[data-modal="confirmar-eliminar"]')).not.toBeNull();
    expect(document.activeElement?.hasAttribute('data-cancelar')).toBeTrue();
  });

  it('confirmar devuelve true; cancelar devuelve false', async () => {
    let resultado = firstValueFrom(abrir().closed);
    document.querySelector<HTMLButtonElement>('[data-modal="confirmar-eliminar"] button.bg-danger')!.click();
    expect(await resultado).toBeTrue();

    resultado = firstValueFrom(abrir().closed);
    document.querySelector<HTMLButtonElement>('[data-cancelar]')!.click();
    expect(await resultado).toBeFalse();
  });

  it('Esc cierra sin confirmar (resultado falsy)', async () => {
    const resultado = firstValueFrom(abrir().closed);
    // CDK detecta Esc por `keyCode`.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true } as KeyboardEventInit));
    expect(await resultado).toBeFalsy();
  });
});
