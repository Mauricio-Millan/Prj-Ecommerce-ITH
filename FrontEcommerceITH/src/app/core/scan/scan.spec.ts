import { Equipo, Producto } from '../catalog/catalog.models';
import { DetectorLector } from './lector-usb';
import { eanValido, resolverCodigo } from './scan.logic';

const p = (id: number, sku: string, numero_parte: string | null, codigo_barras: string | null): Producto => ({ id, sku, numero_parte, codigo_barras, activo: true }) as Producto;
const eq = (id: number, modelo: string, codigo_modelo: string | null, codigos: string[]): Equipo => ({ id, modelo, codigo_modelo, codigos, marca_id: 1, especificaciones: {} });

const datos = {
  productos: [p(1, 'BAT-L19M3PF4', 'L19M3PF4', '2000000000015'), p(2, 'BAT-A', 'SHARED-1', '2000000000022'), p(3, 'BAT-B', 'SHARED-1', null)],
  equipos: [eq(1, 'IdeaPad 3 15ITL6', '82H8', ['IdeaPad 3 15ITL6', '82H8'])],
};
const TIENDA = 'https://tienda.test';

describe('eanValido', () => {
  it('acepta EAN-13, UPC-A y EAN-8 con dígito correcto y rechaza el resto', () => {
    expect(eanValido('2000000000015')).toBeTrue();
    expect(eanValido('4006381333931')).toBeTrue();
    expect(eanValido('036000291452')).toBeTrue(); // UPC-A
    expect(eanValido('96385074')).toBeTrue(); // EAN-8
    expect(eanValido('2000000000016')).toBeFalse();
    expect(eanValido('L19M3PF4')).toBeFalse();
    expect(eanValido('12345')).toBeFalse();
  });
});

describe('resolverCodigo (spec 014)', () => {
  it('CA-1.5/1.7: SKU, número de parte y código de barras, sin importar mayúsculas, espacios ni guiones', () => {
    for (const t of ['BAT-L19M3PF4', 'bat l19m3pf4', 'L19M3-PF4', '2000000000015', ' 02000000000015 '.trim().slice(1)]) {
      const r = resolverCodigo(t, datos, 'buscador');
      expect(r.tipo).withContext(t).toBe('producto');
    }
  });

  it('CA-1.5: un número de parte compartido devuelve varios', () => {
    const r = resolverCodigo('shared-1', datos, 'buscador');
    expect(r.tipo).toBe('varios');
    if (r.tipo === 'varios') expect(r.productos.length).toBe(2);
  });

  it('CA-1.7: un UPC-A y su EAN-13 con un cero delante son el mismo código', () => {
    const d = { ...datos, productos: [p(9, 'X-1', null, '0036000291452')] };
    expect(resolverCodigo('036000291452', d, 'buscador').tipo).toBe('producto');
  });

  it('CA-1.6: un código desconocido o con el dígito del EAN mal leído no coincide', () => {
    expect(resolverCodigo('ZZZ-999', datos, 'buscador').tipo).toBe('ninguno');
    expect(resolverCodigo('2000000000016', datos, 'buscador').tipo).toBe('ninguno');
    expect(resolverCodigo('   ', datos, 'buscador').tipo).toBe('ninguno');
  });

  it('CA-1.8: un QR de la tienda abre la ficha; uno de otro sitio es externo', () => {
    expect(resolverCodigo(`${TIENDA}/producto/BAT-L19M3PF4`, datos, 'buscador', TIENDA).tipo).toBe('producto');
    expect(resolverCodigo('https://otro.example/producto/BAT-L19M3PF4', datos, 'buscador', TIENDA).tipo).toBe('externo');
    expect(resolverCodigo(`${TIENDA}/otra-cosa`, datos, 'buscador', TIENDA).tipo).toBe('externo');
  });

  it('CA-3.2 a 3.4: en "mi-equipo" se resuelven equipos por modelo o código de máquina; un número de serie no', () => {
    expect(resolverCodigo('82h8', datos, 'mi-equipo').tipo).toBe('equipo');
    expect(resolverCodigo('ideapad 3 15itl6', datos, 'mi-equipo').tipo).toBe('equipo');
    expect(resolverCodigo('PF2ABCD1', datos, 'mi-equipo').tipo).toBe('ninguno');
    expect(resolverCodigo('BAT-L19M3PF4', datos, 'mi-equipo').tipo).toBe('ninguno');
  });
});

describe('QR de una laptop (spec 014)', () => {
  const asus = eq(2, 'Zenbook 14 OLED', 'UX3405MA', ['Zenbook 14 OLED', 'UX3405MA']);
  const d = { ...datos, equipos: [...datos.equipos, asus] };

  it('un QR con una dirección de otro sitio que nombra el modelo se reconoce como equipo, sin abrir la dirección', () => {
    const r = resolverCodigo('https://www.asus.com/support/?model=UX3405MA&sn=ABC123', d, 'buscador', TIENDA);
    expect(r.tipo).toBe('equipo');
  });

  it('un QR de texto largo con el modelo adentro se reconoce como equipo, en "mi-equipo" y en el buscador', () => {
    for (const o of ['mi-equipo', 'buscador'] as const) expect(resolverCodigo('ASUS|UX3405MA|SN:R9N0CV123|2024-03', d, o).tipo).withContext(o).toBe('equipo');
  });

  it('un QR de otro sitio que no nombra ningún equipo sigue siendo externo (no se abre)', () => {
    expect(resolverCodigo('https://www.asus.com/support/', d, 'buscador', TIENDA).tipo).toBe('externo');
  });

  it('un producto exacto sigue ganando sobre un equipo, y un texto sin coincidencias no es nada', () => {
    expect(resolverCodigo('BAT-L19M3PF4', d, 'buscador').tipo).toBe('producto');
    expect(resolverCodigo('SN:R9N0CV123|2024-03', d, 'buscador').tipo).toBe('ninguno');
  });

  const QR_ASUS = 'https://www.asus.com/us/laptops/for-home/zenbook/asus-zenbook-14-oled-um3406/helpdesk_knowledge/?model2Name=UM3406HA&qsid=kI5Wl9MZlBCSStf2/jaRdw==';
  const zenbook = eq(5, 'Zenbook 14 OLED UM3406HA', 'UM3406HA', ['Zenbook 14 OLED UM3406HA', 'UM3406HA', 'UM3406']);

  it('el QR real de una Zenbook (model2Name) se reconoce como ese equipo en el buscador y en "mi-equipo"', () => {
    for (const o of ['buscador', 'mi-equipo'] as const) {
      const r = resolverCodigo(QR_ASUS, { ...datos, equipos: [...datos.equipos, zenbook] }, o, TIENDA);
      expect(r.tipo).withContext(o).toBe('equipo');
      if (r.tipo === 'equipo') expect(r.equipos.map((e) => e.id)).toEqual([5]);
    }
  });

  it('un QR que nombra un modelo sin registrar sigue sin abrirse, pero informa el modelo', () => {
    const r = resolverCodigo(QR_ASUS, datos, 'buscador', TIENDA);
    expect(r).toEqual({ tipo: 'externo', url: QR_ASUS, modelo: 'UM3406HA' });
  });

  it('un parámetro de modelo con un valor sin aspecto de modelo se ignora', () => {
    const r = resolverCodigo('https://x.example/?model=<script>', datos, 'buscador', TIENDA);
    expect(r).toEqual({ tipo: 'externo', url: 'https://x.example/?model=<script>' });
  });

  it('un código corto dentro de un token aleatorio de la dirección no es una coincidencia', () => {
    expect(resolverCodigo('https://x.example/ayuda?qsid=kI582H8Wl9', datos, 'buscador', TIENDA).tipo).toBe('externo');
    expect(resolverCodigo('LOTE-A82H8B|2024', datos, 'buscador').tipo).toBe('ninguno');
  });

  it('un modelo demasiado corto no se busca dentro de textos largos (evita falsos positivos)', () => {
    const corto = { ...d, equipos: [eq(3, 'X1', 'X1', ['X1'])] };
    expect(resolverCodigo('ASUS|UX3405MA|X1CARBON', corto, 'buscador').tipo).toBe('ninguno');
  });
});

describe('DetectorLector (spec 014, HU-2)', () => {
  const teclear = (d: DetectorLector, texto: string, intervalo: number, inicio = 1000): string | null => {
    let t = inicio;
    for (const ch of texto) {
      d.tecla(ch, t);
      t += intervalo;
    }
    return d.tecla('Enter', t);
  };

  it('CA-2.1: una ráfaga rápida terminada en Enter es una lectura', () => {
    expect(teclear(new DetectorLector(), 'L19M3PF4', 15)).toBe('L19M3PF4');
  });

  it('CA-2.2: escribir a ritmo humano no es una lectura', () => {
    expect(teclear(new DetectorLector(), 'L19M3PF4', 180)).toBeNull();
    expect(teclear(new DetectorLector(), 'L19M3PF4', 90)).toBeNull();
  });

  it('un texto corto, aunque sea rápido, no es una lectura', () => {
    expect(teclear(new DetectorLector(), 'abc', 10)).toBeNull();
  });

  it('una lectura después de escribir a mano se detecta sola (la pausa reinicia)', () => {
    const d = new DetectorLector();
    teclear(d, 'hola', 200);
    expect(teclear(d, '2000000000015', 12, 9000)).toBe('2000000000015');
  });
});
