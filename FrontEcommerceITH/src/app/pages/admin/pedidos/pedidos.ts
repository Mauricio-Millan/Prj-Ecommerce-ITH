import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { paginar } from '../../../core/catalog/catalog.logic';
import { LanguageService } from '../../../core/i18n/language.service';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { FiltroEstadoPedido, filtrarPedidos } from '../../../core/orders/orders-admin.logic';
import { OrdersApi } from '../../../core/orders/orders.api';
import { CAMPO } from '../../../shared/ui/form-classes';

const TAMANO = 15;
const FILTROS: FiltroEstadoPedido[] = ['todos', 'por_enviar', 'pendiente_pago', 'pagado', 'enviado', 'entregado', 'cancelado'];

/** Lista de pedidos del panel (spec 010, HU-1): estado escrito, los "por enviar" señalados, filtros y paginación. */
@Component({
  selector: 'app-pedidos-admin',
  imports: [RouterLink, TranslocoPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-pedidos" class="mx-auto grid max-w-5xl gap-4">
      <h1 class="text-2xl font-bold">{{ 'adminOrder.list.title' | transloco }}</h1>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="grid gap-1">
          <label for="po-q" class="text-sm font-semibold">{{ 'adminOrder.list.search' | transloco }}</label>
          <input id="po-q" type="search" [class]="campo" [value]="q()" [placeholder]="'adminOrder.list.searchPlaceholder' | transloco" (input)="q.set($any($event.target).value); pagina.set(1)" />
        </div>
        <div class="grid gap-1">
          <label for="po-estado" class="text-sm font-semibold">{{ 'adminOrder.list.status' | transloco }}</label>
          <select id="po-estado" [class]="campo" (change)="estado.set($any($event.target).value); pagina.set(1)">
            @for (f of filtros; track f) {
              <option [value]="f" [selected]="estado() === f">{{ 'adminOrder.filter.' + f | transloco }}</option>
            }
          </select>
        </div>
      </div>

      <p role="status" class="text-sm text-muted">{{ 'adminOrder.list.count' | transloco: { n: filtrados().length } }}</p>

      @if (pag().items.length) {
        <ul class="grid gap-2" [attr.aria-label]="'adminOrder.list.title' | transloco">
          @for (p of pag().items; track p.codigo) {
            <li class="flex flex-wrap items-center gap-3 rounded-card border border-border p-3">
              <div class="min-w-0 flex-1 basis-48">
                <p class="text-sm font-semibold">{{ p.codigo }}</p>
                <p class="text-xs text-muted">{{ fecha(p.created_at) }} · {{ p.envio.destinatario || p.comprobante_nombre }}</p>
              </div>
              <p class="text-sm font-semibold">S/ {{ p.total_pen_centimos / 100 | number: '1.2-2' }}</p>
              <p class="rounded-control border px-2 py-1 text-xs font-semibold" [class]="p.estado === 'pagado' ? 'border-primary text-primary' : 'border-border'">{{ 'adminOrder.status.' + p.estado | transloco }}</p>
              <a [routerLink]="['/admin/pedidos', p.codigo]" data-track="admin.pedido-abrir" class="inline-flex min-h-11 items-center rounded-control border border-border-control px-3 text-sm font-semibold hover:bg-surface-muted">{{ 'adminOrder.list.open' | transloco }}</a>
            </li>
          }
        </ul>
        @if (pag().total > tamano) {
          <nav class="flex items-center justify-between gap-2" [attr.aria-label]="'adminProduct.list.pages' | transloco">
            <button type="button" class="min-h-11 rounded-control border border-border-control px-4 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="pagina() === 1" (click)="pagina.set(pagina() - 1)">{{ 'adminProduct.list.prev' | transloco }}</button>
            <span class="text-sm">{{ 'adminProduct.list.page' | transloco: { n: pagina(), total: paginas() } }}</span>
            <button type="button" class="min-h-11 rounded-control border border-border-control px-4 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="pagina() >= paginas()" (click)="pagina.set(pagina() + 1)">{{ 'adminProduct.list.next' | transloco }}</button>
          </nav>
        }
      } @else {
        <p class="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">{{ 'adminOrder.list.empty' | transloco }}</p>
      }
    </div>
  `,
})
export default class PedidosAdmin {
  private readonly todos = inject(OrdersApi).listarTodos();
  private readonly consulta = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly lang = inject(LanguageService).lang;

  protected readonly campo = CAMPO;
  protected readonly tamano = TAMANO;
  protected readonly filtros = FILTROS;
  protected readonly q = signal('');
  protected readonly estado = signal<FiltroEstadoPedido>(FILTROS.includes(this.consulta.get('estado') as FiltroEstadoPedido) ? (this.consulta.get('estado') as FiltroEstadoPedido) : 'todos');
  protected readonly pagina = signal(1);

  protected readonly filtrados = computed(() => filtrarPedidos(this.todos, this.estado(), this.q()));
  protected readonly pag = computed(() => paginar(this.filtrados(), this.pagina(), TAMANO));
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / TAMANO)));

  constructor() {
    tituloDePagina('adminOrder.list.title');
  }

  protected fecha = (iso: string): string => new Date(iso).toLocaleDateString(this.lang());
}
