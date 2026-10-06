import { Catalogo, Producto } from '../catalog/catalog.models';
import { combinar, detallar, fijarCantidad, quitar, reconciliar, restaurar, resumen, sumar } from './cart.logic';
import { LineaCarrito } from './cart.models';

const p = (sku: string, precio_usd: number, stock: number, activo = true) => ({ sku, precio_usd, stock, activo, nombre: `Producto ${sku}` }) as Producto;
const A: LineaCarrito = { sku: 'A', cantidad: 1 };
const B: LineaCarrito = { sku: 'B', cantidad: 2 };
const C: LineaCarrito = { sku: 'C', cantidad: 3 };

describe('cart.logic: cantidades', () => {
  it('sumar respeta el stock y marca limitado; sumar un sku existente no crea otra línea', () => {
    const r = sumar([{ sku: 'A', cantidad: 3 }], 'A', 3, 4);
    expect(r).toEqual({ items: [{ sku: 'A', cantidad: 4 }], agregadas: 1, limitado: true });
  });

  it('fijarCantidad no baja de 1 ni supera el stock', () => {
    expect(fijarCantidad([A], 'A', 0, 5)[0].cantidad).toBe(1);
    expect(fijarCantidad([A], 'A', -3, 5)[0].cantidad).toBe(1);
    expect(fijarCantidad([A], 'A', 9, 5)[0].cantidad).toBe(5);
    expect(fijarCantidad([A], 'A', 3, 5)[0].cantidad).toBe(3);
  });
});

describe('cart.logic: eliminar y deshacer', () => {
  it('quitar + restaurar devuelve la línea al mismo índice', () => {
    const { items, quitada } = quitar([A, B, C], 'B');
    expect(items).toEqual([A, C]);
    expect(restaurar(items, quitada!)).toEqual([A, B, C]);
  });

  it('con dos quitadas, restaurar la primera recupera ESA línea y no toca a la otra', () => {
    const uno = quitar([A, B, C], 'A');
    const dos = quitar(uno.items, 'B');
    const conA = restaurar(dos.items, uno.quitada!);
    expect(conA.map((l) => l.sku).sort()).toEqual(['A', 'C']);
    expect(conA.find((l) => l.sku === 'A')).toEqual(A);
  });

  it('restaurar un sku que volvió a agregarse suma las cantidades; quitar un sku inexistente no hace nada', () => {
    expect(restaurar([{ sku: 'A', cantidad: 2 }], { linea: A, indice: 0 })).toEqual([{ sku: 'A', cantidad: 3 }]);
    expect(quitar([A], 'Z').quitada).toBeNull();
  });
});

describe('cart.logic: reconciliar', () => {
  const catalogo = [p('A', 10, 5), p('B', 10, 3), p('C', 10, 0), p('D', 10, 4, false)];

  it('quita lo inexistente o inactivo, ajusta lo que supera el stock y MANTIENE lo agotado', () => {
    const r = reconciliar([A, { sku: 'B', cantidad: 5 }, C, { sku: 'D', cantidad: 1 }, { sku: 'Z', cantidad: 1 }], catalogo);
    expect(r.items).toEqual([A, { sku: 'B', cantidad: 3 }, C]);
    expect(r.avisos).toEqual([
      { tipo: 'ajustado', sku: 'B', disponible: 3 },
      { tipo: 'quitado', sku: 'D', nombre: 'Producto D' },
      { tipo: 'quitado', sku: 'Z', nombre: 'Z' },
    ]);
  });
});

describe('cart.logic: detallar y resumen (dinero en céntimos)', () => {
  it('el combo AM5 de la T3 (199+159+59+299+55+49+65 USD) con TC 3.75 = 331875 céntimos (S/ 3,318.75)', () => {
    const precios = [199, 159, 59, 299, 55, 49, 65];
    const catalogo = precios.map((u, i) => p(`P${i}`, u, 5));
    const r = resumen(detallar(catalogo.map((x) => ({ sku: x.sku, cantidad: 1 })), catalogo, 3.75));
    expect(r.totalPenCentimos).toBe(331875);
    expect(r.puedePagar).toBeTrue();
  });

  it('la suma de los subtotales mostrados es EXACTAMENTE el total (precio redondeado por unidad)', () => {
    const catalogo = [p('A', 12.9, 9), p('B', 0.01, 9)];
    const lineas = detallar([{ sku: 'A', cantidad: 3 }, { sku: 'B', cantidad: 7 }], catalogo, 3.75);
    expect(lineas[0].precioPenCentimos).toBe(4838); // 48.375 → 48.38
    expect(lineas[0].subtotalPenCentimos).toBe(14514);
    expect(resumen(lineas).totalPenCentimos).toBe(lineas.reduce((s, l) => s + l.subtotalPenCentimos!, 0));
  });

  it('un agotado no se suma y bloquea el pago con motivo "agotados"', () => {
    const catalogo = [p('A', 10, 5), p('C', 100, 0)];
    const r = resumen(detallar([A, { sku: 'C', cantidad: 2 }], catalogo, 3.75));
    expect(r).toEqual(jasmine.objectContaining({ agotados: 1, puedePagar: false, motivo: 'agotados', totalPenCentimos: 3750, unidades: 1 }));
  });

  it('sin tipo de cambio: precio en soles null, motivo "sin-tc", y los USD siguen disponibles', () => {
    const lineas = detallar([A], [p('A', 10, 5)], null);
    expect(lineas[0].precioPenCentimos).toBeNull();
    expect(lineas[0].subtotalUsdCentimos).toBe(1000);
    expect(resumen(lineas)).toEqual(jasmine.objectContaining({ motivo: 'sin-tc', puedePagar: false, totalUsdCentimos: 1000 }));
  });

  it('carrito vacío → motivo "vacio"; una línea ajustada se marca como tal', () => {
    expect(resumen([]).motivo).toBe('vacio');
    expect(detallar([A], [p('A', 10, 5)], 3.75, new Set(['A']))[0].estado).toBe('ajustado');
  });

  it('con los precios reales del catálogo, el carrito usa el mismo precio unitario que la ficha', async () => {
    const c: Catalogo = await (await fetch('data/seed/catalogo.json')).json();
    const bateria = c.productos.find((x) => x.sku === 'BAT-L19M3PF4')!;
    expect(detallar([A].map(() => ({ sku: bateria.sku, cantidad: 1 })), c.productos, 3.75)[0].precioPenCentimos).toBe(22463);
  });
});

describe('cart.logic: combinar', () => {
  const catalogo = [p('A', 10, 5), p('B', 10, 3), p('N', 10, 9)];

  it('las líneas de la cuenta primero, luego las nuevas; un sku en ambos suma sin pasar del stock', () => {
    const r = combinar([{ sku: 'B', cantidad: 2 }, { sku: 'N', cantidad: 1 }], [A, { sku: 'B', cantidad: 2 }], catalogo);
    expect(r.items).toEqual([A, { sku: 'B', cantidad: 3 }, { sku: 'N', cantidad: 1 }]);
    expect(r.agregadas).toBe(2);
  });

  it('con el carrito anónimo vacío no se agrega nada', () => {
    expect(combinar([], [A], catalogo)).toEqual({ items: [A], agregadas: 0 });
  });
});
