import { LANGUAGES } from './languages';

describe('LANGUAGES', () => {
  it('el quechua está configurado pero no se muestra en el selector (CA-2.7)', () => {
    expect(LANGUAGES.some((l) => l.code === 'qu-PE')).toBeTrue();
    expect(LANGUAGES.filter((l) => l.enabled).map((l) => l.nativeName)).toEqual(['Español', 'English']);
  });
});
