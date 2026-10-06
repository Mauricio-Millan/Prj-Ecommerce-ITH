import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Producto } from '../catalog/catalog.models';
import { MiEquipoService } from '../compat/mi-equipo.service';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { ToastService } from '../../shared/ui/toast/toast';
import { CartApi } from './cart.api';

export type OrigenAgregar = 'tarjeta' | 'ficha';

/** El aviso de incompatibilidad dura más que uno normal para dar tiempo a leerlo y usar sus acciones (spec 003, CA-4.1). */
const DURACION_ADVERTENCIA_MS = 10_000;

/**
 * "Agregar al carrito" para la tarjeta y la ficha (H4: se comportan igual): agrega, avisa con "Ver carrito" y "Deshacer"
 * en menos de 1 s (H1, H3) y registra `add_to_cart` (CA-5.5, CA-8.2).
 * Con "Mi equipo" indicado (spec 003, plan § 5.1) también avisa si el producto NO es compatible —se agrega igual y se puede
 * deshacer, sin interrumpir con un diálogo— o pide revisarlo si no hay datos, y registra `compatible` en el evento.
 */
@Injectable({ providedIn: 'root' })
export class AddToCart {
  private readonly cart = inject(CartApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly logger = inject(InteractionLogger);
  private readonly miEquipo = inject(MiEquipoService);

  agregar(producto: Producto, cantidad: number, origen: OrigenAgregar): void {
    const { agregadas, limitado } = this.cart.agregar(producto.sku, cantidad, producto.stock);

    if (agregadas === 0) {
      this.toast.show('cart.maxReached', 'advertencia', [{ clave: 'cart.view', ejecutar: () => this.router.navigateByUrl('/carrito') }]);
      return;
    }

    const estado = this.miEquipo.evaluar(producto)?.estado;
    const compatible = estado === 'compatible' ? true : estado === 'incompatible' ? false : null;
    this.logger.track('add_to_cart', { sku: producto.sku, origen, cantidad: agregadas, compatible });

    const deshacer = () => {
      this.cart.deshacerUltimo();
      this.logger.track('undo', { accion: 'agregar', sku: producto.sku });
    };

    if (estado === 'incompatible') {
      this.advertirIncompatible(producto, deshacer);
      return;
    }

    const normal = limitado ? 'cart.addedLimited' : estado === 'sin_datos' ? 'compat.addedCheck' : 'cart.added';
    this.toast.show(
      normal,
      limitado ? 'advertencia' : 'exito',
      [
        { clave: 'cart.view', ejecutar: () => this.router.navigateByUrl('/carrito') },
        { clave: 'cart.undo', ejecutar: deshacer },
      ],
      { n: agregadas, max: producto.stock },
    );
  }

  private advertirIncompatible(producto: Producto, deshacer: () => void): void {
    const decidir = (decision: 'deshacer' | 'ver_compatibles') => this.logger.track('compat_warning', { sku: producto.sku, decision });
    this.toast.show(
      'compat.warning',
      'advertencia',
      [
        {
          clave: 'cart.undo',
          track: 'compatibilidad.deshacer-incompatible',
          ejecutar: () => {
            deshacer();
            decidir('deshacer');
          },
        },
        {
          clave: 'compat.seeCompatibleShort',
          track: 'compatibilidad.ver-compatibles',
          ejecutar: () => {
            decidir('ver_compatibles');
            this.router.navigate(['/catalogo', this.miEquipo.slugSubcategoria(producto)], { queryParams: { compat: 1 } });
          },
        },
      ],
      { equipo: this.miEquipo.nombre() },
      {
        duracionMs: DURACION_ADVERTENCIA_MS,
        pausarAlEnfocar: true,
        // Se cerró o venció sin usar ninguna acción: es el dato que dice si el aviso posterior basta (CA-5.2).
        alIgnorar: () => this.logger.track('compat_warning', { sku: producto.sku, decision: 'ignorar' }),
      },
    );
  }
}
