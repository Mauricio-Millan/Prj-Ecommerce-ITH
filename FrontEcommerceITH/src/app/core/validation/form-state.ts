import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { map, scan, switchMap } from 'rxjs';

/**
 * Los formularios reactivos no son signals: con `OnPush` y sin zona, un `computed` que lea `control.errors` no se entera de los cambios.
 * Esto da un contador que sube con cada cambio de valor, estado o "tocado" para que el `computed` dependa de él. Solo en un contexto de inyección.
 */
export const cambios = (control: AbstractControl): Signal<number> =>
  toSignal(control.events.pipe(map(() => 1), scan((n, x) => n + x, 0)), { initialValue: 0 });

/** Igual que `cambios`, pero para un formulario que llega como `input()` (subcomponentes): se vuelve a enganchar si cambia el formulario. */
export const cambiosDe = (control: Signal<AbstractControl>): Signal<number> =>
  toSignal(
    toObservable(control).pipe(
      switchMap((c) => c.events.pipe(map(() => 1))),
      scan((n, x) => n + x, 0),
    ),
    { initialValue: 0 },
  );

/** Código del primer error si el campo ya se tocó o se intentó enviar (CA-1.4: los errores no aparecen antes de tiempo). */
export function codigoDeError(control: AbstractControl, intentado: boolean): string | null {
  if (!control.invalid || !(control.touched || intentado)) return null;
  return Object.keys(control.errors ?? {})[0] ?? null;
}
