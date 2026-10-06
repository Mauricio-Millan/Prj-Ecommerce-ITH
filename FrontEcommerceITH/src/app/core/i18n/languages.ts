export interface Idioma {
  code: string;
  /** Nombre en el propio idioma, nunca traducido (CA-2.5). */
  nativeName: string;
  /** `false` = configurado pero oculto en el selector hasta validar sus traducciones (CA-2.7). */
  enabled: boolean;
}

export const LANGUAGES: readonly Idioma[] = [
  { code: 'es-PE', nativeName: 'Español', enabled: true },
  { code: 'en-US', nativeName: 'English', enabled: true },
  { code: 'qu-PE', nativeName: 'Runa simi', enabled: false },
];

export const DEFAULT_LANG = 'es-PE';
