import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../../core/i18n/language.service';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { siguientesEstados } from '../../../core/orders/orders-admin.logic';
import { OrdersApi } from '../../../core/orders/orders.api';
import { EstadoPedido, Pedido } from '../../../core/orders/orders.models';
import { AdminField } from '../../../shared/ui/admin-field/admin-field';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';

/** Detalle de un pedido y avance de su estado (spec 010, HU-2 y HU-3). Cada cambio pide confirmar; cancelar exige motivo. */
@Component({
  selector: 'app-pedido-admin',
  imports: [RouterLink, TranslocoPipe, DecimalPipe, AdminField, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-pedido" class="mx-auto grid max-w-3xl gap-4">
      @if (pedido(); as p) {
        <a routerLink="/admin/pedidos" class="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline print:hidden"><app-icon name="volver" [size]="16" /> {{ 'adminOrder.back' | transloco }}</a>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h1 class="text-2xl font-bold">{{ p.codigo }}</h1>
          <p class="rounded-control border border-border px-3 py-1 text-sm font-semibold">{{ 'adminOrder.status.' + p.estado | transloco }}</p>
        </div>

        <section class="grid gap-2 rounded-card border border-border p-4" aria-labelledby="pd-envio">
          <h2 id="pd-envio" class="text-lg font-semibold">{{ 'adminOrder.shipping' | transloco }}</h2>
          <p>{{ p.envio.destinatario }} · {{ p.envio.telefono }}</p>
          <p>{{ p.envio.direccion }}, {{ p.envio.distrito }}, {{ p.envio.provincia }}, {{ p.envio.departamento }}</p>
          @if (p.envio.referencia) {
            <p class="text-sm text-muted">{{ 'adminOrder.reference' | transloco }}: {{ p.envio.referencia }}</p>
          }
        </section>

        <section class="grid gap-2 rounded-card border border-border p-4" aria-labelledby="pd-items">
          <h2 id="pd-items" class="text-lg font-semibold">{{ 'adminOrder.items' | transloco }}</h2>
          <ul class="grid gap-2">
            @for (i of p.items; track i.sku) {
              <li class="flex items-center gap-3">
                <img [src]="i.imagen" alt="" width="40" height="40" class="size-10 shrink-0 rounded-control bg-surface-muted object-cover" />
                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 text-sm font-semibold">{{ i.nombre_producto }}</p>
                  <p class="text-xs text-muted">{{ i.sku }} · {{ i.cantidad }} × S/ {{ i.precio_unitario_pen_centimos / 100 | number: '1.2-2' }}</p>
                </div>
                <p class="text-sm">S/ {{ i.subtotal_pen_centimos / 100 | number: '1.2-2' }}</p>
              </li>
            }
          </ul>
          <dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-2 text-sm">
            <dt>{{ 'adminOrder.taxable' | transloco }}</dt><dd>S/ {{ p.op_gravada_pen_centimos / 100 | number: '1.2-2' }}</dd>
            <dt>{{ 'adminOrder.igv' | transloco }}</dt><dd>S/ {{ p.igv_pen_centimos / 100 | number: '1.2-2' }}</dd>
            <dt class="font-semibold">{{ 'adminOrder.total' | transloco }}</dt><dd class="font-semibold">S/ {{ p.total_pen_centimos / 100 | number: '1.2-2' }}</dd>
          </dl>
        </section>

        <section class="grid gap-2 rounded-card border border-border p-4" aria-labelledby="pd-pago">
          <h2 id="pd-pago" class="text-lg font-semibold">{{ 'adminOrder.payment' | transloco }}</h2>
          @for (pago of p.pagos; track pago.fecha) {
            <p class="text-sm">{{ 'adminOrder.method.' + pago.metodo | transloco }} · {{ 'adminOrder.result.' + pago.resultado | transloco }} · {{ fecha(pago.fecha) }}</p>
          } @empty {
            <p class="text-sm text-muted">{{ 'adminOrder.noPayment' | transloco }}</p>
          }
        </section>

        <section class="grid gap-2 rounded-card border border-border p-4" aria-labelledby="pd-hist">
          <h2 id="pd-hist" class="text-lg font-semibold">{{ 'adminOrder.history' | transloco }}</h2>
          <ol class="grid gap-1 text-sm">
            @for (h of p.historial_estados; track h.fecha) {
              <li>{{ fecha(h.fecha) }} — <span class="font-semibold">{{ 'adminOrder.status.' + h.estado | transloco }}</span>@if (h.motivo) { · {{ h.motivo }} }</li>
            }
          </ol>
        </section>

        <!-- Acciones: solo los pasos válidos (CA-3.5). -->
        <section class="grid gap-3 print:hidden" aria-labelledby="pd-acc">
          <h2 id="pd-acc" class="text-lg font-semibold">{{ 'adminOrder.actions' | transloco }}</h2>
          @if (pendiente(); as nuevo) {
            <div role="alert" class="grid gap-3 rounded-card border border-border bg-surface-muted p-3">
              <p class="font-semibold">{{ 'adminOrder.confirm' | transloco: { codigo: p.codigo, estado: ('adminOrder.status.' + nuevo | transloco) } }}</p>
              @if (nuevo === 'cancelado') {
                <app-admin-field campoId="pd-motivo" etiqueta="adminOrder.reason" ayuda="adminOrder.reasonHelp" [error]="errorMotivo() ? 'motivo' : null" [requerido]="true">
                  <textarea id="pd-motivo" rows="2" [class]="errorMotivo() ? campoError : campo" [value]="motivo()" [attr.aria-invalid]="errorMotivo()" (input)="motivo.set($any($event.target).value)"></textarea>
                </app-admin-field>
                <p class="text-sm text-muted">{{ 'adminOrder.cancelStock' | transloco }}</p>
              }
              <div class="flex flex-wrap gap-2">
                <button type="button" data-track="admin.pedido-confirmar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover" (click)="aplicar(p, nuevo)">{{ 'adminOrder.confirmButton' | transloco }}</button>
                <button type="button" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface" (click)="pendiente.set(null)">{{ 'adminProduct.form.cancel' | transloco }}</button>
              </div>
            </div>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (s of siguientes(p); track s) {
                <button type="button" [attr.data-track]="'admin.pedido-' + s" class="min-h-11 rounded-control border px-4 font-semibold hover:bg-surface-muted" [class]="s === 'cancelado' ? 'border-danger text-danger' : 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover'" (click)="elegir(s)">{{ 'adminOrder.action.' + s | transloco }}</button>
              } @empty {
                <p class="text-sm text-muted">{{ 'adminOrder.noActions' | transloco }}</p>
              }
              <button type="button" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="imprimir()">{{ 'adminOrder.print' | transloco }}</button>
            </div>
          }
        </section>
      } @else {
        <h1 class="text-2xl font-bold">{{ 'adminOrder.notFound' | transloco }}</h1>
        <a routerLink="/admin/pedidos" class="text-primary underline">{{ 'adminOrder.back' | transloco }}</a>
      }
    </div>
  `,
})
export default class PedidoAdmin {
  private readonly api = inject(OrdersApi);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly lang = inject(LanguageService).lang;
  private readonly codigo = inject(ActivatedRoute).snapshot.paramMap.get('codigo') ?? '';

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;
  protected readonly pedido = signal<Pedido | null>(this.api.obtenerAdmin(this.codigo));
  protected readonly pendiente = signal<EstadoPedido | null>(null);
  protected readonly motivo = signal('');
  protected readonly errorMotivo = signal(false);
  protected readonly siguientes = (p: Pedido): EstadoPedido[] => siguientesEstados(p.estado);
  protected readonly titulo = computed(() => this.pedido()?.codigo ?? '');

  constructor() {
    tituloDePagina('adminOrder.list.title');
  }

  protected fecha = (iso: string): string => new Date(iso).toLocaleString(this.lang());

  protected elegir(estado: EstadoPedido): void {
    this.motivo.set('');
    this.errorMotivo.set(false);
    this.pendiente.set(estado);
  }

  protected async aplicar(p: Pedido, nuevo: EstadoPedido): Promise<void> {
    if (nuevo === 'cancelado' && !this.motivo().trim()) {
      this.errorMotivo.set(true);
      return;
    }
    const r = await this.api.cambiarEstado(p.codigo, nuevo, this.motivo());
    if (!r.ok) {
      this.toast.show('adminOrder.invalid', 'error');
      this.pedido.set(this.api.obtenerAdmin(p.codigo));
      this.pendiente.set(null);
      return;
    }
    this.pedido.set(r.pedido);
    this.pendiente.set(null);
    this.toast.show('adminOrder.changed', 'exito', [], { codigo: p.codigo, estado: this.i18n.translate(`adminOrder.status.${nuevo}`) });
    if (r.sinProducto.length) this.toast.show('adminOrder.noStock', 'advertencia', [], { lista: r.sinProducto.join(', ') });
  }

  protected imprimir(): void {
    window.print();
  }
}
