import { Catalogo, Compatibilidad } from './catalog.models';

/** Integridad de los datos de ejemplo (plan § 7): lee los JSON reales que sirve la app. */
describe('datos de ejemplo del catálogo', () => {
  let c: Catalogo;
  let compat: Compatibilidad;

  beforeAll(async () => {
    c = await (await fetch('data/seed/catalogo.json')).json();
    compat = await (await fetch('data/seed/compatibilidad.json')).json();
  });

  it('cada producto tiene categoría y marca existentes y precio ≥ 0', () => {
    for (const p of c.productos) {
      expect(c.categorias.some((x) => x.id === p.categoria_id)).withContext(p.sku).toBeTrue();
      expect(c.marcas.some((m) => m.id === p.marca_id)).withContext(p.sku).toBeTrue();
      expect(p.precio_usd).withContext(p.sku).toBeGreaterThanOrEqual(0);
    }
  });

  it('los sku son únicos y cada producto trae imágenes con texto alternativo', () => {
    expect(new Set(c.productos.map((p) => p.sku)).size).toBe(c.productos.length);
    for (const p of c.productos) expect(p.imagenes.every((i) => i.alt.length > 0)).withContext(p.sku).toBeTrue();
  });

  it('todo atributo ⚙ de la subcategoría tiene valor y está dentro de valores_permitidos', () => {
    for (const p of c.productos) {
      for (const a of c.atributos.filter((x) => x.categoria_id === p.categoria_id && x.usa_compatibilidad)) {
        const valor = p.especificaciones[a.clave];
        expect(valor).withContext(`${p.sku}.${a.clave}`).toBeDefined();
        if (a.valores_permitidos) {
          for (const v of Array.isArray(valor) ? valor : [valor]) expect(a.valores_permitidos).withContext(`${p.sku}.${a.clave}=${v}`).toContain(v as string);
        }
      }
    }
  });

  it('composición del plan § 1.3: 22 productos, 13 de PC, 2 de laptop y Pantallas vacía', () => {
    const raiz = (slug: string) => c.categorias.find((x) => x.slug === slug)!.id;
    const deRaiz = (slug: string) => c.productos.filter((p) => c.categorias.find((x) => x.id === p.categoria_id)?.padre_id === raiz(slug));
    expect(c.productos.length).toBe(22);
    expect(deRaiz('componentes-pc').length).toBe(13);
    expect(deRaiz('componentes-laptop').length).toBe(2);
    expect(deRaiz('pantallas').length).toBe(0);
    expect(c.productos.filter((p) => p.destacado).map((p) => p.sku).sort()).toEqual(
      ['BAT-L19M3PF4', 'CPU-R5-5600', 'GPU-RTX4060', 'MB-B650M', 'MOU-M170', 'SSD-NV2-1TB'],
    );
  });

  it('estados de la spec: un agotado y los de pocas unidades', () => {
    const stock = (sku: string) => c.productos.find((p) => p.sku === sku)!.stock;
    expect(stock('GPU-RX7600')).toBe(0);
    expect(stock('CPU-R5-7600')).toBe(4);
    expect(stock('MOU-DX110')).toBe(3);
  });

  it('reglas del armador (008): son 6, sus slugs existen y sus atributos existen en las subcategorías que relacionan', () => {
    expect(compat.reglas_compatibilidad.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
    const slug = (s: string) => c.categorias.find((x) => x.slug === s);
    for (const r of compat.reglas_compatibilidad) {
      for (const origen of r.origen) {
        expect(slug(origen)).withContext(`regla ${r.id} origen ${origen}`).toBeDefined();
        expect(c.atributos.some((a) => a.categoria_id === slug(origen)!.id && a.clave === r.atributo_origen)).withContext(`regla ${r.id}.${r.atributo_origen}`).toBeTrue();
      }
      expect(slug(r.destino)).withContext(`regla ${r.id} destino ${r.destino}`).toBeDefined();
      expect(c.atributos.some((a) => a.categoria_id === slug(r.destino)!.id && a.clave === r.atributo_destino)).withContext(`regla ${r.id}.${r.atributo_destino}`).toBeTrue();
    }
  });

  it('los 13 productos de PC tienen los atributos que usan las reglas y los pasos (T002)', () => {
    const idsPc = c.categorias.filter((x) => x.padre_id === c.categorias.find((r) => r.slug === 'componentes-pc')!.id).map((x) => x.id);
    for (const r of compat.reglas_compatibilidad) {
      for (const [slugCat, clave] of [...r.origen.map((o) => [o, r.atributo_origen]), [r.destino, r.atributo_destino]] as [string, string][]) {
        const cat = c.categorias.find((x) => x.slug === slugCat)!;
        expect(idsPc).toContain(cat.id);
        for (const p of c.productos.filter((x) => x.categoria_id === cat.id)) expect(p.especificaciones[clave]).withContext(`${p.sku}.${clave}`).toBeDefined();
      }
    }
    const cpu = (sku: string) => c.productos.find((p) => p.sku === sku)!.especificaciones;
    expect([cpu('CPU-R5-5600')['graficos_integrados'], cpu('CPU-R5-7600')['graficos_integrados']]).toEqual([false, true]);
    expect([cpu('CPU-R5-5600')['incluye_disipador'], cpu('CPU-R5-7600')['incluye_disipador']]).toEqual([true, true]);
  });

  it('compatibilidad: lista de baterías y Dell sin datos', () => {
    const id = (sku: string) => c.productos.find((p) => p.sku === sku)!.id;
    const equiposDe = (sku: string) => compat.producto_compatibilidad.filter((x) => x.producto_id === id(sku)).map((x) => x.equipo_id);
    expect(equiposDe('BAT-L19M3PF4')).toEqual([1]);
    expect(equiposDe('BAT-GEN-IDEAPAD3')).toEqual([1]);
    expect(equiposDe('BAT-L17C3PF1')).toEqual([2]);
    expect(compat.equipos.find((e) => e.modelo.startsWith('Inspiron'))!.especificaciones).toEqual({});
  });
});
