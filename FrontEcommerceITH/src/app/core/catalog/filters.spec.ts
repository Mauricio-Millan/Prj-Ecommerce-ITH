import { convertToParamMap } from '@angular/router';
import { Atributo, Catalogo, Producto } from './catalog.models';
import {
  ContextoFiltros, FILTROS_VACIOS, FiltrosActivos, aplicar, alternarOpcion, diferencia, entradas, facetas, fijarBooleano, fijarRango, nivel, quitarEntrada, quitarUltimo,
} from './filters.logic';
import { aUrl, desdeUrl, leerRango } from './filters.url';

describe('filtros (datos reales)', () => {
  let c: Catalogo;
  let ctx: ContextoFiltros;
  const deSub = (slug: string) => {
    const id = c.categorias.find((x) => x.slug === slug)!.id;
    return c.productos.filter((p) => p.categoria_id === id);
  };
  const deRaiz = (slug: string) => {
    const raiz = c.categorias.find((x) => x.slug === slug)!.id;
    const ids = c.categorias.filter((x) => x.padre_id === raiz).map((x) => x.id);
    return c.productos.filter((p) => ids.includes(p.categoria_id));
  };
  const marcaId = (nombre: string) => c.marcas.find((m) => m.nombre === nombre)!.id;
  const faceta = (fs: ReturnType<typeof facetas>, id: string) => fs.find((f) => f.id === id);

  beforeAll(async () => {
    c = await (await fetch('data/seed/catalogo.json')).json();
    ctx = { categorias: c.categorias, marcas: c.marcas, atributos: c.atributos };
  });

  it('con 2 subcategorías → no técnico; con 1 → técnico (CA-5.1)', () => {
    expect(nivel(deRaiz('componentes-pc')).tecnico).toBeFalse();
    const ram = nivel(deSub('memoria-ram-pc'));
    expect(ram.tecnico).toBeTrue();
    expect(ram.subcategoriaId).not.toBeNull();
  });

  it('en una categoría raíz solo salen los filtros comunes; en una subcategoría, también los técnicos', () => {
    const raiz = facetas(deRaiz('componentes-pc'), ctx, FILTROS_VACIOS);
    expect(raiz.every((f) => !f.tecnica)).toBeTrue();
    expect(raiz.map((f) => f.id)).toEqual(['sub', 'marca', 'precio', 'disp']);

    const ram = facetas(deSub('memoria-ram-pc'), ctx, FILTROS_VACIOS);
    expect(ram.map((f) => f.id)).toEqual(['precio', 'tipo_ram']); // una sola marca, una sola subcategoría, todo disponible, capacidad igual en ambas
    expect(faceta(ram, 'tipo_ram')!.tecnica).toBeTrue();
    expect(faceta(ram, 'tipo_ram')!.ayudaClave).toBe('attr.tipo_ram.help');
  });

  it('la cantidad de una opción ignora los filtros de su propia faceta (se puede sumar DDR4 o DDR5)', () => {
    const ram = deSub('memoria-ram-pc');
    const fs = facetas(ram, ctx, { atributos: { tipo_ram: ['DDR4'] } });
    const opciones = faceta(fs, 'tipo_ram')!.opciones;
    expect(opciones.map((o) => [o.valor, o.cantidad, o.marcada, o.deshabilitada])).toEqual([['DDR4', 1, true, false], ['DDR5', 1, false, false]]);
  });

  it('las opciones que dejarían la lista vacía quedan deshabilitadas con (0) (CA-5.4)', () => {
    const fs = facetas(deRaiz('componentes-pc'), ctx, { marca: [marcaId('Kingston')], atributos: {} });
    const sub = faceta(fs, 'sub')!.opciones;
    expect(sub.find((o) => o.valor === 'memoria-ram-pc')).toEqual(jasmine.objectContaining({ cantidad: 2, deshabilitada: false }));
    expect(sub.find((o) => o.valor === 'procesadores')).toEqual(jasmine.objectContaining({ cantidad: 0, deshabilitada: true }));
  });

  it('OR dentro de una faceta y AND entre facetas (CA-5.5)', () => {
    const pc = deRaiz('componentes-pc');
    const ddr = aplicar(pc, { atributos: { tipo_ram: ['DDR4', 'DDR5'] } }, ctx).map((p) => p.sku);
    expect(ddr.sort()).toEqual(['MB-B550M', 'MB-B650M', 'RAM-KF432-16', 'RAM-KF556-16']);
    const kingstonDdr4 = aplicar(pc, { marca: [marcaId('Kingston')], atributos: { tipo_ram: ['DDR4'] } }, ctx).map((p) => p.sku);
    expect(kingstonDdr4).toEqual(['RAM-KF432-16']);
  });

  it('precio en USD, solo disponibles y sí/no', () => {
    const pc = deRaiz('componentes-pc');
    expect(aplicar(pc, { precio: { min: 100, max: 200 }, atributos: {} }, ctx).map((p) => p.sku).sort()).toEqual(['CPU-R5-5600', 'CPU-R5-7600', 'MB-B550M', 'MB-B650M']);
    expect(aplicar(pc, { disponible: true, atributos: {} }, ctx).some((p) => p.sku === 'GPU-RX7600')).toBeFalse();
    expect(aplicar(pc, { atributos: { graficos_integrados: true } }, ctx).map((p) => p.sku)).toEqual(['CPU-R5-7600']);
  });

  it('el filtro "disponibilidad" aparece en PC porque hay un agotado; sin agotados no se muestra', () => {
    expect(faceta(facetas(deRaiz('componentes-pc'), ctx, FILTROS_VACIOS), 'disp')!.cantidad).toBe(12);
    expect(faceta(facetas(deSub('memoria-ram-pc'), ctx, FILTROS_VACIOS), 'disp')).toBeUndefined();
  });

  it('máximo 6 facetas desplegadas; el resto queda en "Más filtros" (CA-5.2)', () => {
    const atrs: Atributo[] = Array.from({ length: 8 }, (_, i) => ({
      id: i, categoria_id: 99, clave: `a${i}`, clave_i18n: `attr.a${i}.label`, tipo: 'booleano', unidad: null, valores_permitidos: null, filtrable: true, usa_compatibilidad: false, orden: i,
    }));
    const prods: Producto[] = [0, 1, 2].map((n) => ({
      id: n, sku: `S${n}`, categoria_id: 99, marca_id: 1, nombre: '', modelo: '', descripcion: '', numero_parte: null, precio_usd: 10 + n, stock: 1, garantia_meses: 0, condicion: 'nuevo',
      imagenes: [], destacado: false, activo: true, created_at: '', especificaciones: Object.fromEntries(atrs.map((a) => [a.clave, n === 0])),
    }));
    const fs = facetas(prods, { categorias: [{ id: 99, padre_id: 1, slug: 'x', clave_i18n: 'x', icono: 'cpu', orden: 1 }], marcas: [], atributos: atrs }, FILTROS_VACIOS);
    expect(fs.filter((f) => f.visible).length).toBe(6);
    expect(fs.length).toBeGreaterThan(6);
  });

  it('alternar, rango, sí/no, quitar entrada, quitar el último y diferencia', () => {
    const fs = facetas(deSub('memoria-ram-pc'), ctx, FILTROS_VACIOS);
    const ddr4 = alternarOpcion(FILTROS_VACIOS, faceta(fs, 'tipo_ram')!, 'DDR4');
    expect(ddr4.atributos).toEqual({ tipo_ram: ['DDR4'] });
    expect(alternarOpcion(ddr4, faceta(fs, 'tipo_ram')!, 'DDR4').atributos).toEqual({}); // se desmarca

    const conPrecio = fijarRango(ddr4, faceta(fs, 'precio')!, { min: 10 });
    expect(entradas(conPrecio)).toEqual([{ id: 'precio', valor: '10-' }, { id: 'tipo_ram', valor: 'DDR4' }]);
    expect(entradas(quitarEntrada(conPrecio, { id: 'precio', valor: '10-' }))).toEqual([{ id: 'tipo_ram', valor: 'DDR4' }]);
    expect(entradas(quitarUltimo(conPrecio))).toEqual([{ id: 'precio', valor: '10-' }]);
    expect(diferencia(FILTROS_VACIOS, conPrecio).map((d) => `${d.accion}:${d.id}`)).toEqual(['aplicar:precio', 'aplicar:tipo_ram']);
    expect(diferencia(conPrecio, FILTROS_VACIOS).every((d) => d.accion === 'quitar')).toBeTrue();
    expect(fijarBooleano(FILTROS_VACIOS, { ...fs[0], id: 'disp' }, true).disponible).toBeTrue();
  });
});

describe('filters.url', () => {
  const atributos = [
    { clave: 'tipo_ram', tipo: 'lista' }, { clave: 'capacidad_gb', tipo: 'numero' }, { clave: 'incluye_disipador', tipo: 'booleano' },
  ] as Atributo[];
  const ida = (a: FiltrosActivos) => {
    const params = Object.fromEntries(Object.entries(aUrl(a)).filter(([, v]) => v !== null)) as Record<string, string>;
    return desdeUrl(convertToParamMap(params), atributos);
  };

  it('ida y vuelta para lista, rango, sí/no y precio', () => {
    const a: FiltrosActivos = {
      subcategoria: ['memoria-ram-pc', 'procesadores'], marca: [3, 7], precio: { min: 100, max: 300 }, disponible: true,
      atributos: { tipo_ram: ['DDR4', 'DDR5'], capacidad_gb: { min: 16, max: 32 }, incluye_disipador: true },
    };
    expect(ida(a)).toEqual(a);
  });

  it('un solo extremo del rango: -300 y 100-', () => {
    expect(aUrl({ precio: { max: 300 }, atributos: {} })['precio']).toBe('-300');
    expect(aUrl({ precio: { min: 100 }, atributos: {} })['precio']).toBe('100-');
    expect(ida({ precio: { max: 300 }, atributos: {} }).precio).toEqual({ max: 300 });
    expect(leerRango('100-')).toEqual({ min: 100 });
  });

  it('parámetros desconocidos o inválidos se ignoran', () => {
    const a = desdeUrl(convertToParamMap({ q: 'ram', pagina: '2', orden: 'precio-asc', foo: 'x', precio: 'abc', marca: 'x,3' }), atributos);
    expect(a).toEqual({ marca: [3], atributos: {} });
  });

  it('las claves conocidas que no están activas salen en null (para que "merge" las borre de la URL)', () => {
    const r = aUrl({ marca: [3], atributos: {} }, ['tipo_ram']);
    expect(r['marca']).toBe('3');
    expect(r['tipo_ram']).toBeNull();
    expect(r['sub']).toBeNull();
  });
});
