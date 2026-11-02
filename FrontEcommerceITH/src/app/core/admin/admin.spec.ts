import { Atributo, Categoria, Marca, Producto } from '../catalog/catalog.models';
import { Pedido } from '../orders/orders.models';
import { aplicarTransicion, filtrarPedidos, siguientesEstados, stockTrasCancelar } from '../orders/orders-admin.logic';
import { valorTipoCambioValido } from '../currency/exchange-rate.api';
import { BorradorProducto, ContextoValidacion, aProducto, aBorrador, borradorVacio, especificacionesQueSePierden, estadoAdmin, filtrarProductosAdmin, validarProducto } from './producto.logic';

const categorias: Categoria[] = [
  { id: 1, padre_id: null, slug: 'comp', clave_i18n: '', icono: 'carrito', orden: 1 },
  { id: 6, padre_id: 1, slug: 'cpu', clave_i18n: '', icono: 'carrito', orden: 1 },
  { id: 9, padre_id: 1, slug: 'disco', clave_i18n: '', icono: 'carrito', orden: 2 },
];
const marcas: Marca[] = [{ id: 1, nombre: 'AMD' }];
const atributos: Atributo[] = [
  { id: 1, categoria_id: 6, clave: 'socket', clave_i18n: '', tipo: 'lista', unidad: null, valores_permitidos: ['AM4', 'AM5'], filtrable: true, usa_compatibilidad: true, orden: 1 },
  { id: 2, categoria_id: 6, clave: 'nucleos', clave_i18n: '', tipo: 'numero', unidad: null, valores_permitidos: null, filtrable: true, usa_compatibilidad: false, orden: 2 },
  { id: 3, categoria_id: 6, clave: 'integrada', clave_i18n: '', tipo: 'booleano', unidad: null, valores_permitidos: null, filtrable: false, usa_compatibilidad: false, orden: 3 },
  { id: 4, categoria_id: 9, clave: 'capacidad', clave_i18n: '', tipo: 'texto', unidad: null, valores_permitidos: null, filtrable: false, usa_compatibilidad: false, orden: 1 },
];
const existente = { id: 1, sku: 'CPU-R5', categoria_id: 6, marca_id: 1, nombre: 'Procesador Ryzen 5', modelo: 'R5', numero_parte: null, codigo_barras: '2000000000015', precio_usd: 100, stock: 3, garantia_meses: 12, condicion: 'nuevo', descripcion: 'Procesador de seis nucleos', especificaciones: { socket: 'AM4' }, imagenes: [], destacado: false, activo: true, created_at: 'x' } as unknown as Producto;
const ctx = (skuOriginal: string | null = null): ContextoValidacion => ({ productos: [existente], categorias, atributos, marcas, skuOriginal });

const valido = (): BorradorProducto => ({
  ...borradorVacio(), sku: 'CPU-R7', nombre: 'Procesador Ryzen 7', categoria_id: 6, marca_id: 1, modelo: 'R7', descripcion: 'Procesador de ocho núcleos y 16 hilos',
  precio_usd: '199.90', stock: '4', imagenes: [{ url: 'images/x.webp', alt: 'Procesador' }], especificaciones: { socket: 'AM5', nucleos: '8' },
});

describe('validarProducto (spec 009)', () => {
  it('un borrador completo no da errores', () => {
    expect(validarProducto(valido(), ctx())).toEqual({});
  });

  it('CA-2.4: SKU obligatorio, con formato y sin duplicar', () => {
    expect(validarProducto({ ...valido(), sku: '' }, ctx())['sku']).toBe('requerido');
    expect(validarProducto({ ...valido(), sku: 'cpu r7' }, ctx())['sku']).toBe('sku-formato');
    expect(validarProducto({ ...valido(), sku: 'CPU-R5' }, ctx())['sku']).toBe('sku-duplicado');
    expect(validarProducto({ ...valido(), sku: 'CPU-R5' }, ctx('CPU-R5'))['sku']).toBeUndefined(); // al editar no choca consigo mismo
  });

  it('CA-2.5: precio mayor que 0 con 2 decimales; stock y garantía enteros', () => {
    for (const p of ['', '0', '-5', '10.999', 'abc']) expect(validarProducto({ ...valido(), precio_usd: p }, ctx())['precio']).withContext(p).toBe('precio');
    expect(validarProducto({ ...valido(), stock: '2.5' }, ctx())['stock']).toBe('entero');
    expect(validarProducto({ ...valido(), garantia_meses: '-1' }, ctx())['garantia']).toBe('entero');
  });

  it('CA-2.6: el código de barras es opcional, válido y no repetido', () => {
    expect(validarProducto({ ...valido(), codigo_barras: '' }, ctx())['codigo_barras']).toBeUndefined();
    expect(validarProducto({ ...valido(), codigo_barras: '2000000000016' }, ctx())['codigo_barras']).toBe('ean-invalido');
    expect(validarProducto({ ...valido(), codigo_barras: '2000000000015' }, ctx())['codigo_barras']).toBe('ean-duplicado');
    expect(validarProducto({ ...valido(), sku: 'CPU-R5', codigo_barras: '2000000000015' }, ctx('CPU-R5'))['codigo_barras']).toBeUndefined();
  });

  it('CA-2.7: al menos una imagen y cada una con dirección y texto alternativo', () => {
    expect(validarProducto({ ...valido(), imagenes: [] }, ctx())['imagenes']).toBe('imagen-requerida');
    const e = validarProducto({ ...valido(), imagenes: [{ url: '', alt: '' }] }, ctx());
    expect(e['img.0.url']).toBe('requerido');
    expect(e['img.0.alt']).toBe('alt-requerido');
  });

  it('CA-2.2: la categoría debe ser una subcategoría; los atributos de compatibilidad son obligatorios y se validan por tipo', () => {
    expect(validarProducto({ ...valido(), categoria_id: 1 }, ctx())['categoria']).toBe('categoria');
    expect(validarProducto({ ...valido(), especificaciones: {} }, ctx())['esp.socket']).toBe('esp-requerida');
    expect(validarProducto({ ...valido(), especificaciones: { socket: 'LGA' } }, ctx())['esp.socket']).toBe('esp-lista');
    expect(validarProducto({ ...valido(), especificaciones: { socket: 'AM4', nucleos: 'muchos' } }, ctx())['esp.nucleos']).toBe('esp-numero');
  });

  it('descripción y nombre demasiado cortos', () => {
    expect(validarProducto({ ...valido(), descripcion: 'corta' }, ctx())['descripcion']).toBe('descripcion-corta');
    expect(validarProducto({ ...valido(), nombre: 'abc' }, ctx())['nombre']).toBe('nombre-corto');
  });
});

describe('aProducto y aBorrador', () => {
  it('convierte los tipos, solo conserva los atributos de la categoría y numera las imágenes', () => {
    const b = { ...valido(), especificaciones: { socket: 'AM5', nucleos: '8', integrada: true, capacidad: 'no aplica' } };
    const p = aProducto(b, atributos, { id: 7, created_at: 't' });
    expect(p.precio_usd).toBe(199.9);
    expect(p.stock).toBe(4);
    expect(p.especificaciones).toEqual({ socket: 'AM5', nucleos: 8, integrada: true });
    expect(p.imagenes[0].orden).toBe(1);
    expect(p.numero_parte).toBeNull();
  });

  it('ida y vuelta: editar un producto y guardarlo sin cambios lo deja igual', () => {
    const p = aProducto(aBorrador({ ...existente, imagenes: [{ url: 'a', alt: 'b', orden: 1 }] }), atributos, { id: 1, created_at: 'x' });
    expect(p.sku).toBe('CPU-R5');
    expect(p.especificaciones).toEqual({ socket: 'AM4', integrada: false });
  });

  it('CA-3.4: avisa qué especificaciones se pierden al cambiar de categoría', () => {
    const b = { ...valido(), especificaciones: { socket: 'AM5', nucleos: '8' } };
    expect(especificacionesQueSePierden(b, atributos, 9)).toEqual(['socket', 'nucleos']);
    expect(especificacionesQueSePierden(b, atributos, 6)).toEqual([]);
  });
});

describe('filtrarProductosAdmin y estadoAdmin', () => {
  const p = (sku: string, stock: number, activo: boolean, cat = 6): Producto => ({ ...existente, id: Math.random(), sku, stock, activo, categoria_id: cat, nombre: `Producto ${sku}`, codigo_barras: null }) as Producto;
  const lista = [p('A', 10, true), p('B', 0, true), p('C', 5, false), p('D', 3, true, 9)];

  it('el estado: oculto manda sobre agotado', () => {
    expect(lista.map(estadoAdmin)).toEqual(['activo', 'agotado', 'oculto', 'activo']);
    expect(estadoAdmin({ activo: false, stock: 0 })).toBe('oculto');
  });

  it('CA-1.3: por estado, por categoría y "pocas unidades"', () => {
    const f = (estado: 'todos' | 'activo' | 'oculto' | 'agotado' | 'pocas', categoriaId: number | null = null) => filtrarProductosAdmin(lista, categorias, { q: '', categoriaId, estado }).map((x) => x.sku);
    expect(f('todos')).toEqual(['A', 'B', 'C', 'D']);
    expect(f('oculto')).toEqual(['C']);
    expect(f('agotado')).toEqual(['B']);
    expect(f('pocas')).toEqual(['D']);
    expect(f('todos', 9)).toEqual(['D']);
    expect(f('todos', 1)).toEqual(['A', 'B', 'C', 'D']); // la categoría raíz incluye sus hijas
  });

  it('CA-1.2: busca por nombre y por SKU sin importar mayúsculas ni guiones', () => {
    const q = (t: string) => filtrarProductosAdmin(lista, categorias, { q: t, categoriaId: null, estado: 'todos' }).map((x) => x.sku);
    expect(q('producto c')).toEqual(['C']);
    expect(q('d')).toContain('D');
  });
});

describe('tipo de cambio (CA-5.2)', () => {
  it('mayor que 0 con hasta 4 decimales', () => {
    expect(valorTipoCambioValido('3.78')).toBeTrue();
    expect(valorTipoCambioValido('3.7812')).toBeTrue();
    for (const v of ['', '0', '-1', '3.78123', 'x']) expect(valorTipoCambioValido(v)).withContext(v).toBeFalse();
  });
});

describe('pedidos del panel (spec 010)', () => {
  const pedido = (estado: Pedido['estado']): Pedido =>
    ({ codigo: 'TS-1', estado, created_at: '2026-11-01T00:00:00Z', comprobante_nombre: 'Ana Torres', envio: { destinatario: 'Luis' }, items: [{ sku: 'A', cantidad: 2 }, { sku: 'GONE', cantidad: 1 }], historial_estados: [] }) as unknown as Pedido;
  const ahora = new Date('2026-11-02T00:00:00Z');

  it('CA-3.5: solo los pasos válidos, sin retroceder', () => {
    expect(siguientesEstados('pagado')).toEqual(['enviado', 'cancelado']);
    expect(siguientesEstados('enviado')).toEqual(['entregado']);
    for (const e of ['pendiente_pago', 'entregado', 'cancelado'] as const) expect(siguientesEstados(e)).toEqual([]);
  });

  it('CA-3.1/3.2: avanzar agrega la entrada al historial; un paso inválido da null', () => {
    const e = aplicarTransicion(pedido('pagado'), 'enviado', ahora)!;
    expect(e.estado).toBe('enviado');
    expect(e.historial_estados).toEqual([{ estado: 'enviado', fecha: ahora.toISOString() }]);
    expect(aplicarTransicion(pedido('pagado'), 'entregado', ahora)).toBeNull();
    expect(aplicarTransicion(pedido('entregado'), 'enviado', ahora)).toBeNull();
  });

  it('CA-3.4: cancelar exige motivo y solo desde pagado', () => {
    expect(aplicarTransicion(pedido('pagado'), 'cancelado', ahora)).toBeNull();
    expect(aplicarTransicion(pedido('pagado'), 'cancelado', ahora, '  ')).toBeNull();
    expect(aplicarTransicion(pedido('pagado'), 'cancelado', ahora, 'Cliente lo pidió')!.historial_estados[0].motivo).toBe('Cliente lo pidió');
    expect(aplicarTransicion(pedido('enviado'), 'cancelado', ahora, 'x')).toBeNull();
  });

  it('CA-3.4: cancelar repone el stock y avisa de los SKU que ya no existen', () => {
    const r = stockTrasCancelar(pedido('pagado'), [{ sku: 'A', stock: 5 }]);
    expect(r.stockPorSku).toEqual({ A: 7 });
    expect(r.sinProducto).toEqual(['GONE']);
  });

  it('CA-1.2/1.3: filtra por estado ("por enviar" = pagados) y por código o nombre', () => {
    const lista = [{ ...pedido('pagado'), codigo: 'TS-2' }, pedido('enviado'), { ...pedido('pendiente_pago'), codigo: 'TS-3' }];
    expect(filtrarPedidos(lista, 'por_enviar', '').map((p) => p.codigo)).toEqual(['TS-2']);
    expect(filtrarPedidos(lista, 'todos', 'ana').length).toBe(3);
    expect(filtrarPedidos(lista, 'todos', 'ts-3').map((p) => p.codigo)).toEqual(['TS-3']);
  });
});
