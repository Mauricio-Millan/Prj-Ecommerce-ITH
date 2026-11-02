import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/** Pide confirmar antes de descartar un ingreso o conteo sin confirmar (spec 015, CA-1.7; H3 y H5). */
export const inventarioSinConfirmarGuard: CanDeactivateFn<{ hayPendientes: () => boolean }> = (c) =>
  !c.hayPendientes() || confirm(inject(TranslocoService).translate('inventory.leave'));
