import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Motivo } from '../../core/builder/builder.models';
import { LanguageService } from '../../core/i18n/language.service';

/** Arma el texto del motivo de un conflicto con los valores de las dos piezas: "Socket AM4: no calza con tu procesador AM5" (CA-2.3, 4.1). */
@Injectable({ providedIn: 'root' })
export class MotivoTraductor {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService).lang;

  texto(m: Motivo): string {
    this.lang(); // el texto depende del idioma
    return this.transloco.translate(m.mensaje, { esta: m.esta, otra: m.otra, pieza: this.transloco.translate(`builder.piece.${m.otroPaso}`), consumo: m.consumoW, potencia: m.potenciaW });
  }
}
