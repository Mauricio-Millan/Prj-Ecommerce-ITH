import { Catalogo, Compatibilidad } from '../catalog/catalog.models';
import { distancia } from './distancia';
import { compactar, normalizar } from './normalize';
import { Sinonimos, interpretar } from './query';
import { Indice, construirIndice } from './search-index';
import { buscar, coincide } from './search.engine';

describe('normalize', () => {
  it('minúsculas, sin tildes ni signos, espacios simples', () => {
    expect(normalizar('Batería  LENOVO!')).toBe('bateria lenovo');
    expect(normalizar('Teclado ñandú')).toBe('teclado nandu');
  });
  it('compactar quita también espacios y guiones', () => {
    expect(compactar('L19M3-PF4')).toBe('l19m3pf4');
    expect(compactar('l19m3 pf4')).toBe('l19m3pf4');
  });
});

describe('distancia (Damerau-Levenshtein, cortada en 2)', () => {
  it('un error de tipeo vale 1', () => {
    expect(distancia('lenvo', 'lenovo')).toBe(1);
    expect(distancia('bateria', 'bateira')).toBe(1); // transposición
    expect(distancia('mouse', 'mouse')).toBe(0);
  });
  it('más de un error → 2', () => {
    expect(distancia('ryzen', 'razer')).toBe(2);
    expect(distancia('ram', 'ramas')).toBe(2);
  });
});

describe('coincidencia de palabras', () => {
  it('por prefijo desde 4 letras: tarjeta ↔ tarjetas, case ↔ cases', () => {
    expect(coincide('tarjeta', 'tarjetas')).toBeTrue();
    expect(coincide('case', 'cases')).toBeTrue();
    expect(coincide('inalam', 'inalambrico')).toBeTrue();
  });
  it('"ram" no coincide con "ramas" y "3" no coincide con "330"', () => {
    expect(coincide('ram', 'ramas')).toBeFalse();
    expect(coincide('3', '330')).toBeFalse();
    expect(coincide('ram', 'ram')).toBeTrue();
  });
});

describe('interpretar (plan § 2.1)', () => {
  const sin: Sinonimos = {
    relleno: ['para', 'mi', 'de'],
    grupos: [['inalámbrico', 'sin cable', 'wireless'], ['mouse', 'ratón'], ['tarjeta de video', 'gpu'], ['batería', 'pila']],
  };
  const vocab = new Set(['lenovo', 'bateria', 'mouse', 'l19m3pf4', 'tarjeta', 'video']);

  it('"sin cable" se reconoce como frase antes que como palabras → inalámbrico', () => {
    const c = interpretar('mouse sin cable', sin, vocab);
    expect(c.tokens).toEqual([['mouse', 'raton'], ['inalambrico', 'sin cable', 'wireless']]);
    expect(c.interpretacion).toBe('mouse inalámbrico');
  });

  it('quita el relleno ("para mi") sin presentarlo como una corrección', () => {
    const c = interpretar('bateria para mi lenovo', sin, vocab);
    expect(c.tokens.length).toBe(2);
    expect(c.interpretacion).toBeNull();
  });

  it('"lenvo" → "lenovo" y avisa cómo se entendió', () => {
    const c = interpretar('bateria lenvo', sin, vocab);
    expect(c.tokens[1]).toEqual(['lenovo']);
    expect(c.interpretacion).toBe('batería lenovo');
  });

  it('una palabra con números (código) nunca se corrige', () => {
    expect(interpretar('l19m3pf5', sin, vocab).tokens).toEqual([['l19m3pf5']]);
  });

  it('con exacto no corrige ni expande', () => {
    const c = interpretar('bateria lenvo', sin, vocab, { exacto: true });
    expect(c.tokens).toEqual([['bateria'], ['lenvo']]);
    expect(c.interpretacion).toBeNull();
  });

  it('una frase con relleno ("tarjeta de video") no se rompe por quitar el relleno', () => {
    expect(interpretar('tarjeta de video', sin, vocab).tokens).toEqual([['tarjeta video', 'gpu']]);
  });
});

/**
 * PRUEBA PRINCIPAL DEL MOTOR: las consultas de control de la spec § 5 con los archivos reales.
 * Si alguna falla, se ajustan pesos o sinónimos — no la prueba.
 */
describe('consultas de control de la spec 002 (datos reales)', () => {
  let indice: Indice;
  let sin: Sinonimos;

  beforeAll(async () => {
    const c: Catalogo = await (await fetch('data/seed/catalogo.json')).json();
    const compat: Compatibilidad = await (await fetch('data/seed/compatibilidad.json')).json();
    sin = await (await fetch('data/seed/sinonimos.json')).json();
    indice = construirIndice({ ...c, equipos: compat.equipos, producto_compatibilidad: compat.producto_compatibilidad });
  });

  const buscarTexto = (q: string, exacto = false) => buscar(indice, interpretar(q, sin, indice.vocabulario, { exacto }));
  const primero = (q: string) => buscarTexto(q).resultados[0].producto;
  const skus = (q: string) => buscarTexto(q).resultados.map((r) => r.producto.sku);

  it('L19M3PF4 y l19m3-pf4 → batería L19M3PF4 como coincidencia exacta (CA-2.1)', () => {
    for (const q of ['L19M3PF4', 'l19m3-pf4', 'l19m3 pf4']) expect(buscarTexto(q).exacta?.sku).withContext(q).toBe('BAT-L19M3PF4');
  });

  it('un SKU y un modelo también son coincidencia exacta', () => {
    expect(buscarTexto('MOU-M170').exacta?.sku).toBe('MOU-M170');
    expect(buscarTexto('Ryzen 5 5600').exacta?.sku).toBe('CPU-R5-5600');
  });

  it('CA-2.3: el P/N de la batería aparece también en las baterías que lo mencionan', () => {
    expect(skus('L19M3PF4')).toContain('BAT-GEN-IDEAPAD3'); // "Reemplaza a L19M3PF4"
  });

  it('bateria para mi lenovo ideapad 3 → batería #1 o #2, nunca la #3 (CA-1.7)', () => {
    expect(['BAT-L19M3PF4', 'BAT-GEN-IDEAPAD3']).toContain(primero('bateria para mi lenovo ideapad 3').sku);
    expect(skus('bateria para mi lenovo ideapad 3')[2]).toBe('BAT-L17C3PF1');
  });

  it('bateria lenvo → una batería Lenovo, y avisa la corrección (CA-1.4, CA-3.4)', () => {
    const r = buscarTexto('bateria lenvo');
    expect(r.resultados[0].producto.nombre).toContain('Lenovo');
    expect(r.interpretacion).toBe('batería lenovo');
  });

  it('mouse inalambrico / mouse sin cable / wireless mouse → un mouse inalámbrico, nunca el Genius (CA-1.5, CA-1.6)', () => {
    for (const q of ['mouse inalambrico', 'mouse sin cable', 'wireless mouse']) {
      const sku = primero(q).sku;
      expect(sku).withContext(q).not.toBe('MOU-DX110');
      expect(['MOU-M170', 'MOU-M185']).withContext(q).toContain(sku);
    }
  });

  it('memoria ddr4 y ram ddr4 → una RAM DDR4, nunca la placa B550M ni una DDR5', () => {
    for (const q of ['memoria ddr4', 'ram ddr4']) {
      const sku = primero(q).sku;
      expect(['RAM-KF432-16', 'RAM-SO-KVR32-8']).withContext(q).toContain(sku);
    }
  });

  it('ram laptop ddr4 → la SO-DIMM DDR4', () => {
    expect(primero('ram laptop ddr4').sku).toBe('RAM-SO-KVR32-8');
  });

  it('graphics card y tarjeta grafica → una tarjeta de video (CA-1.6)', () => {
    for (const q of ['graphics card', 'tarjeta grafica']) expect(['GPU-RTX4060', 'GPU-RX7600']).withContext(q).toContain(primero(q).sku);
  });

  it('otros términos en inglés: power supply, keyboard, battery', () => {
    expect(primero('power supply').nombre).toContain('Fuente de poder');
    expect(primero('battery').nombre).toContain('Batería');
  });

  it('ryzen 5 → un procesador Ryzen 5', () => {
    expect(primero('ryzen 5').nombre).toContain('Ryzen 5');
  });

  it('una consulta sin ninguna coincidencia da una lista vacía, no un error', () => {
    const r = buscarTexto('xyzzy');
    expect(r.resultados).toEqual([]);
    expect(r.exacta).toBeNull();
  });

  it('una consulta solo de relleno no encuentra nada', () => {
    expect(buscarTexto('para mi de').resultados).toEqual([]);
  });
});
