import { Injectable, inject } from '@angular/core';
import { CartApi } from '../cart/cart.api';
import { CatalogApi } from '../catalog/catalog.api';
import { Producto } from '../catalog/catalog.models';
import { CurrencyService } from '../currency/currency.service';
import { precioPenCentimos } from '../currency/money';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { Pedido } from './orders.models';

export interface ResultadoReorder {
  /** Productos (líneas) que se agregaron al carrito. */
  agregados: number;
  /** Nombres de los productos sin stock (CA-4.2). */
  agotados: string[];
  /** Nombres de los productos que ya no existen o están inactivos. */
  noDisponibles: string[];
  /** ¿Algún precio actual es distinto del que se pagó? (CA-4.3) */
  preciosCambiaron: boolean;
}

/**
 * "Volver a comprar" (spec 007, HU-4): agrega TODO el pedido en una sola operación, a los precios ACTUALES y limitado al stock.
 * Lo que no se puede agregar se informa; el aviso con "Deshacer" lo arma la página.
 */
@Injectable({ providedIn: 'root' })
export class Reorder {
  private readonly cart = inject(CartApi);
  private readonly catalog = inject(CatalogApi);
  private readonly currency = inject(CurrencyService);
  private readonly logger = inject(InteractionLogger);

  volverAComprar(pedido: Pedido): ResultadoReorder {
    let productos: readonly Producto[] = [];
    this.catalog.todos().subscribe((p) => (productos = p)).unsubscribe();
    const tc = this.currency.exchangeRate() ? Number(this.currency.exchangeRate()!.valor) : null;

    const lineas: { sku: string; cantidad: number; stock: number }[] = [];
    const agotados: string[] = [];
    const noDisponibles: string[] = [];
    let preciosCambiaron = false;

    for (const item of pedido.items) {
      const p = productos.find((x) => x.sku === item.sku);
      if (!p || !p.activo) {
        noDisponibles.push(item.nombre_producto);
        continue;
      }
      preciosCambiaron ||= tc ? precioPenCentimos(p.precio_usd, tc) !== item.precio_unitario_pen_centimos : p.precio_usd !== item.precio_unitario_usd;
      if (p.stock <= 0) agotados.push(item.nombre_producto);
      else lineas.push({ sku: item.sku, cantidad: item.cantidad, stock: p.stock });
    }

    // Una sola operación y un solo "Deshacer" (005, CA-6.1).
    const agregadas = lineas.length ? this.cart.agregarVarios(lineas).agregadas : 0;
    const agregados = agregadas > 0 ? lineas.length : 0;
    this.logger.track('reorder', { codigo: pedido.codigo, agregados, no_disponibles: agotados.length + noDisponibles.length });
    return { agregados, agotados, noDisponibles, preciosCambiaron };
  }
}
