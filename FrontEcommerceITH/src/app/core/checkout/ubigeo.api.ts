import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { Ubigeo } from './ubigeo.logic';

/** Ubigeos de ejemplo (`data/seed/ubigeos.json`). En la Fase 2, la tabla `ubigeos` completa del INEI. */
@Injectable({ providedIn: 'root' })
export class UbigeoApi {
  private readonly lista$ = inject(HttpClient)
    .get<Ubigeo[]>('data/seed/ubigeos.json')
    .pipe(catchError(() => of<Ubigeo[]>([])), shareReplay(1));

  todos(): Observable<Ubigeo[]> {
    return this.lista$;
  }
}
