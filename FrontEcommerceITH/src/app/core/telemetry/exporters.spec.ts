import { aCSV } from './exporters';

describe('exporters', () => {
  it('escapa comas y comillas del detalle en el CSV (T040)', () => {
    const detalle = { q: 'ram, "ddr4"' };
    const csv = aCSV([{ s: 'P01-v1', v: 'v1', t: 1, e: 'search', r: '/', p: '/', d: detalle }]);
    // RFC 4180: entre comillas y con las comillas internas duplicadas.
    expect(csv.endsWith(',"' + JSON.stringify(detalle).replace(/"/g, '""') + '"')).toBeTrue();
  });
});
