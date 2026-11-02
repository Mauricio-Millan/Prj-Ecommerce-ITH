import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/** Pide confirmar antes de salir del formulario con cambios sin guardar (spec 009, CA-2.9; H3 y H5). */
export const productoSinGuardarGuard: CanDeactivateFn<{ hayCambios?: () => boolean }> = (c) =>
  !c.hayCambios?.() || confirm(inject(TranslocoService).translate('adminProduct.form.leave'));
