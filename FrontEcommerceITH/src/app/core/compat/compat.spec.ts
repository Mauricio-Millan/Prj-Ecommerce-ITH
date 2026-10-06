import { Catalogo, Compatibilidad, Equipo, Producto } from '../catalog/catalog.models';
import { ContextoFiltros, FILTROS_VACIOS, aplicar, entradas, facetas } from '../catalog/filters.logic';
import { ContextoCompat, aplica, evaluar } from './compat.logic';
import { buscarEquipos, marcasConEquipos } from './equipos.logic';
import { cumple } from './reglas';

describe('cumple (comparador compartido con la 008)', () => {
  it('compara sin importar mayúsculas ni espacios', () => {
    expect(cumple('igual', 'DDR4', 'ddr4 ')).toBeTrue();
    expect(cumple('igual', 'DDR4', 'DDR5')).toBeFalse();
  });
  it('incluido_en y suma_menor_igual', () => {
    expect(cumple('incluido_en', 'mATX', ['ATX', 'mATX'])).toBeTrue();
    expect(cumple('incluido_en', 'ITX', ['ATX', 'mATX'])).toBeFalse();
    expect(cumple('suma_menor_igual', [115, 65], 550)).toBeTrue();
    expect(cumple('suma_menor_igual', [300, 300], 550)).toBeFalse();
  });
  it('si falta un valor es null (sin datos), nunca false', () => {
    expect(cumple('igual', undefined, 'DDR4')).toBeNull();
    expect(cumple('igual', 'DDR4', null)).toBeNull();
    expect(cumple('suma_menor_igual', [1], undefined)).toBeNull();
  });
});

/** Plan § 9: la tabla de casos de la spec 003 con los JSON reales que sirve la app. */
describe('compatibilidad con "Mi equipo" (datos reales)', () => {
  let c: Catalogo;
  let compat: Compatibilidad;
  let ctx: ContextoCompat;

  const producto = (sku: string) => c.productos.find((p) => p.sku === sku)!;
  const equipo = (modelo: string) => compat.equipos.find((e) => e.modelo === modelo)!;

  beforeAll(async () => {
    c = await (await fetch('data/seed/catalogo.json')).json();
    compat = await (await fetch('data/seed/compatibilidad.json')).json();
    ctx = { categorias: c.categorias, atributos: c.atributos, marcas: c.marcas, equipos: compat.equipos, compatibilidades: compat.producto_compatibilidad };
  });

  it('batería L19M3PF4 con IdeaPad 3 → ✓ por lista', () => {
    const r = evaluar(producto('BAT-L19M3PF4'), equipo('IdeaPad 3 15ITL6'), ctx);
    expect([r.estado, r.nivel]).toEqual(['compatible', 'lista']);
  });

  it('batería L17C3PF1 con IdeaPad 3 → ✗ por lista, y dice para qué modelo es', () => {
    const r = evaluar(producto('BAT-L17C3PF1'), equipo('IdeaPad 3 15ITL6'), ctx);
    expect([r.estado, r.nivel]).toEqual(['incompatible', 'lista']);
    expect(r.paraEquipos).toEqual(['IdeaPad 330-15IKB']);
  });

  it('batería #1 con HP → ✗ por lista (tiene lista y HP no está)', () => {
    expect(evaluar(producto('BAT-L19M3PF4'), equipo('15-dy2xxx'), ctx).estado).toBe('incompatible');
  });

  it('RAM DDR4 SO-DIMM con IdeaPad 3 → ✓ por atributos, con 2 atributos que cumplen', () => {
    const r = evaluar(producto('RAM-SO-KVR32-8'), equipo('IdeaPad 3 15ITL6'), ctx);
    expect([r.estado, r.nivel]).toEqual(['compatible', 'atributos']);
    expect(r.atributos?.filter((a) => a.cumple).length).toBe(2);
  });

  it('RAM DDR5 SO-DIMM con IdeaPad 3 → ✗ por atributos (tipo_ram DDR4 vs DDR5)', () => {
    const r = evaluar(producto('RAM-SO-CT48-16'), equipo('IdeaPad 3 15ITL6'), ctx);
    expect([r.estado, r.nivel]).toEqual(['incompatible', 'atributos']);
    expect(r.atributos?.find((a) => !a.cumple)).toEqual({ clave: 'tipo_ram', equipo: 'DDR4', producto: 'DDR5', cumple: false });
  });

  it('RAM DDR4 con HP → ✓ por atributos; con Dell (sin datos del equipo) → sin confirmar', () => {
    expect(evaluar(producto('RAM-SO-KVR32-8'), equipo('15-dy2xxx'), ctx).estado).toBe('compatible');
    expect(evaluar(producto('RAM-SO-KVR32-8'), equipo('Inspiron 15 3511'), ctx).estado).toBe('sin_datos');
    expect(evaluar(producto('RAM-SO-CT48-16'), equipo('Inspiron 15 3511'), ctx).estado).toBe('sin_datos');
  });

  it('un mouse o una pieza de PC no aplica con ningún equipo', () => {
    for (const e of compat.equipos) {
      expect(evaluar(producto('MOU-M170'), e, ctx).estado).toBe('no_aplica');
      expect(evaluar(producto('RAM-KF432-16'), e, ctx).estado).toBe('no_aplica');
    }
    expect(aplica(producto('MOU-M170'), c.categorias)).toBeFalse();
    expect(aplica(producto('BAT-L19M3PF4'), c.categorias)).toBeTrue();
  });

  it('el filtro compat=1 en Repuestos de laptop con IdeaPad 3 deja solo #1 y #2', () => {
    const ideapad: Equipo = equipo('IdeaPad 3 15ITL6');
    const fctx: ContextoFiltros = {
      categorias: c.categorias,
      marcas: c.marcas,
      atributos: c.atributos,
      compat: {
        hayEquipo: true,
        aplica: (p: Producto) => aplica(p, c.categorias),
        compatible: (p: Producto) => evaluar(p, ideapad, ctx).estado === 'compatible',
      },
    };
    const repuestos = c.productos.filter((p) => c.categorias.find((x) => x.id === p.categoria_id)?.padre_id === c.categorias.find((x) => x.slug === 'repuestos-laptop')!.id);
    const activos = { ...FILTROS_VACIOS, compatible: true };

    expect(aplicar(repuestos, activos, fctx).map((p) => p.sku)).toEqual(['BAT-L19M3PF4', 'BAT-GEN-IDEAPAD3']);
    expect(entradas(activos)).toEqual([{ id: 'compat', valor: '1' }]);

    const primera = facetas(repuestos, fctx, FILTROS_VACIOS)[0];
    expect([primera.id, primera.cantidad]).toEqual(['compat', 2]);
  });

  it('sin equipo no existe la faceta de compatibilidad y compat=1 no filtra nada', () => {
    const fctx: ContextoFiltros = { categorias: c.categorias, marcas: c.marcas, atributos: c.atributos, compat: { hayEquipo: false, aplica: () => true, compatible: () => false } };
    expect(facetas(c.productos, fctx, FILTROS_VACIOS).some((f) => f.id === 'compat')).toBeFalse();
    expect(aplicar(c.productos, { ...FILTROS_VACIOS, compatible: true }, fctx).length).toBe(c.productos.length);
  });

  describe('buscarEquipos', () => {
    const primero = (t: string) => buscarEquipos(t, compat.equipos, c.marcas)[0]?.modelo;
    it('encuentra por código, por modelo, por nombre comercial y con guiones', () => {
      for (const t of ['15itl6', '82H8', 'ideapad 3', 'Lenovo IdeaPad-3']) expect(primero(t)).withContext(t).toBe('IdeaPad 3 15ITL6');
    });
    it('un modelo que no existe no devuelve nada', () => {
      expect(buscarEquipos('macbook', compat.equipos, c.marcas)).toEqual([]);
      expect(buscarEquipos('   ', compat.equipos, c.marcas)).toEqual([]);
    });
    it('el selector por pasos ofrece las 3 marcas con equipos', () => {
      expect(marcasConEquipos(compat.equipos, c.marcas).map((m) => m.nombre)).toEqual(['Dell', 'HP', 'Lenovo']);
    });
  });
});
