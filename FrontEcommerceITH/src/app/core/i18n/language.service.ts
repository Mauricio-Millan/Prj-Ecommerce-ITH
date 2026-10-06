import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { localStore } from '../storage/local-store';
import { DEFAULT_LANG, LANGUAGES } from './languages';

const KEY = 'lang';
const esHabilitado = (code: string | null) => LANGUAGES.some((l) => l.enabled && l.code === code);

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly enabled = LANGUAGES.filter((l) => l.enabled);
  private readonly _lang = signal(this.idiomaInicial());
  readonly lang = this._lang.asReadonly();

  /** Se llama al arrancar: carga las traducciones antes del primer render (sin parpadeo de textos vacíos). */
  init(): Observable<unknown> {
    this.aplicar(this._lang());
    return this.transloco.load(this._lang());
  }

  /** Solo cambia signals: no navega ni recarga, así se conservan carrito, filtros y scroll (CA-2.2). */
  setLang(code: string): void {
    if (!esHabilitado(code) || code === this._lang()) return;
    this._lang.set(code);
    localStore.set(KEY, code);
    this.aplicar(code);
  }

  private aplicar(code: string): void {
    this.transloco.setActiveLang(code);
    this.document.documentElement.lang = code;
  }

  private idiomaInicial(): string {
    const guardado = localStore.get<string>(KEY);
    return esHabilitado(guardado) ? guardado! : DEFAULT_LANG;
  }
}
