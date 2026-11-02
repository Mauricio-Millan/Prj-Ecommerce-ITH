import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { estadoAdmin, pocasUnidades } from '../../../core/admin/producto.logic';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { CurrencyService } from '../../../core/currency/currency.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { OrdersApi } from '../../../core/orders/orders.api';

interface Tarjeta {
  clave: string;
  valor: number;
  enlace: string;
  consulta: Record<string, string>;
}

/** Resumen del panel (spec 009, HU-6): contadores que llevan a la lista ya filtrada, y el tipo de cambio vigente. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-resumen" class="mx-auto grid max-w-4xl gap-6">
      <h1 class="text-2xl font-bold">{{ 'admin.title' | transloco }}</h1>

      <section class="grid gap-3" aria-labelledby="rs-prod">
        <h2 id="rs-prod" class="text-lg font-semibold">{{ 'adminDash.products' | transloco }}</h2>
        <ul class="grid grid-cols-2 gap-3 md:grid-cols-4">
          @for (t of productos; track t.clave) {
            <li>
              <a [routerLink]="t.enlace" [queryParams]="t.consulta" class="grid min-h-11 gap-1 rounded-card border border-border p-3 hover:bg-surface-muted">
                <span class="text-2xl font-bold">{{ t.valor }}</span>
                <span class="text-sm">{{ 'adminDash.' + t.clave | transloco }}</span>
              </a>
            </li>
          }
        </ul>
      </section>

      <section class="grid gap-3" aria-labelledby="rs-ped">
        <h2 id="rs-ped" class="text-lg font-semibold">{{ 'adminDash.orders' | transloco }}</h2>
        <ul class="grid grid-cols-2 gap-3 md:grid-cols-4">
          @for (t of pedidos; track t.clave) {
            <li>
              <a [routerLink]="t.enlace" [queryParams]="t.consulta" class="grid min-h-11 gap-1 rounded-card border border-border p-3 hover:bg-surface-muted">
                <span class="text-2xl font-bold">{{ t.valor }}</span>
                <span class="text-sm">{{ 'adminOrder.status.' + t.clave | transloco }}</span>
              </a>
            </li>
          }
        </ul>
      </section>

      <section class="grid gap-2 rounded-card border border-border p-4" aria-labelledby="rs-tc">
        <h2 id="rs-tc" class="text-lg font-semibold">{{ 'adminRate.current' | transloco }}</h2>
        @if (tc.exchangeRate(); as v) {
          <p class="text-xl font-bold">1 USD = S/ {{ v.valor }}</p>
          <p class="text-sm text-muted">{{ fecha(v.fecha) }}</p>
        } @else {
          <p class="font-semibold">{{ 'adminRate.none' | transloco }}</p>
        }
        <a routerLink="/admin/tipo-cambio" class="inline-flex min-h-11 items-center justify-self-start text-primary underline">{{ 'adminDash.updateRate' | transloco }}</a>
      </section>
    </div>
  `,
})
export default class Dashboard {
  protected readonly tc = inject(CurrencyService);
  private readonly lang = inject(LanguageService).lang;

  protected readonly productos: Tarjeta[];
  protected readonly pedidos: Tarjeta[];

  constructor() {
    tituloDePagina('admin.title');
    const lista = inject(CatalogApi).adminDatos().productos;
    const cuenta = (e: string) => lista.filter((p) => estadoAdmin(p) === e).length;
    this.productos = [
      { clave: 'active', valor: cuenta('activo'), enlace: '/admin/productos', consulta: { estado: 'activo' } },
      { clave: 'hidden', valor: cuenta('oculto'), enlace: '/admin/productos', consulta: { estado: 'oculto' } },
      { clave: 'soldOut', valor: cuenta('agotado'), enlace: '/admin/productos', consulta: { estado: 'agotado' } },
      { clave: 'low', valor: lista.filter(pocasUnidades).length, enlace: '/admin/productos', consulta: { estado: 'pocas' } },
    ];
    const todos = inject(OrdersApi).listarTodos();
    this.pedidos = (['pagado', 'enviado', 'entregado', 'cancelado'] as const).map((e) => ({
      clave: e, valor: todos.filter((p) => p.estado === e).length, enlace: '/admin/pedidos', consulta: { estado: e },
    }));
  }

  protected fecha = (iso: string): string => new Date(iso).toLocaleDateString(this.lang());
}
