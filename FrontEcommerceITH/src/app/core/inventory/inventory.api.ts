import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '../catalog/catalog.api';
import { SessionApi } from '../auth/session.api';
import { localStore } from '../storage/local-store';
import { ErrorLote, LineaInventario, ModoInventario, Movimiento, MotivoAjuste, aplicarLote } from './inventory.logic';

const KEY = 'inventario_movimientos';

export type ResultadoConfirmar = { ok: true; productos: number; unidades: number } | { ok: false; error: ErrorLote; sku?: string };

/**
 * Inventario de la Fase 1 (spec 015): modifica el stock de `ts_catalogo` con UNA escritura y agrega los movimientos a
 * `ts_inventario_movimientos`. Los movimientos solo se agregan: no hay forma de editarlos ni borrarlos (CA-3.3).
 * En la Fase 2 el cuerpo de `confirmar` pasa a `POST /api/v1/inventario/movimientos` (transacción en Postgres).
 */
@Injectable({ providedIn: 'root' })
export class InventarioApi {
  private readonly catalogo = inject(CatalogApi);
  private readonly session = inject(SessionApi);

  readonly movimientos = signal<Movimiento[]>(localStore.get<Movimiento[]>(KEY) ?? []);

  async confirmar(lineas: LineaInventario[], modo: ModoInventario, motivo: MotivoAjuste | null): Promise<ResultadoConfirmar> {
    const productos = await firstValueFrom(this.catalogo.todos());
    const r = aplicarLote(productos, lineas, modo, motivo, this.session.usuario()?.email ?? 'admin', new Date(), crypto.randomUUID());
    if (!r.ok) return r;
    this.catalogo.reemplazarStock(r.stockPorSku);
    const todos = [...r.movimientos, ...this.movimientos()];
    localStore.set(KEY, todos);
    this.movimientos.set(todos);
    return { ok: true, productos: r.movimientos.length, unidades: r.unidades };
  }
}
