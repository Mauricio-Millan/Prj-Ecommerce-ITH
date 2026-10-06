import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LogoutService } from '../../../core/auth/logout.service';
import { SessionApi } from '../../../core/auth/session.api';
import { NavigationHistory } from '../../../core/auth/volver';
import { CartApi } from '../../../core/cart/cart.api';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { CurrencySelector } from '../../../shared/ui/currency-selector/currency-selector';
import { Icon } from '../../../shared/ui/icon/icon';
import { LanguageSelector } from '../../../shared/ui/language-selector/language-selector';
import { MobileMenu } from '../mobile-menu/mobile-menu';
import { SearchBox } from '../search-box/search-box';

/** Patrón Z en escritorio: logo → buscador → preferencias, cuenta y carrito (constitución P1, CA-1.1). */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, Icon, LanguageSelector, CurrencySelector, SearchBox, CdkMenuTrigger, CdkMenu, CdkMenuItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block sticky top-0 z-30 border-b border-border bg-surface print:hidden' },
  template: `
    <p class="flex items-center justify-center gap-2 bg-primary px-4 py-1 text-xs text-primary-foreground sm:text-sm">
      <app-icon name="envio" [size]="16" />
      {{ 'shipping.included' | transloco }}
      <span class="hidden sm:inline" aria-hidden="true">·</span>
      <span class="hidden sm:inline">{{ 'currency.igvIncluded' | transloco }}</span>
    </p>

    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2 sm:gap-x-2 md:flex-nowrap md:gap-x-4">
      <button
        type="button"
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted md:hidden"
        data-zone="categorias"
        data-track="categorias.abrir-menu"
        [attr.aria-label]="'header.menu' | transloco"
        (click)="abrirMenu()"
      >
        <app-icon name="menu" />
      </button>

      <a routerLink="/" class="rounded-control text-xl font-bold tracking-tight text-primary" data-track="logo.inicio">TechSuply</a>

      <app-search-box class="order-last w-full md:order-none md:max-w-xl md:flex-1" />


      <div class="ml-auto flex items-center sm:gap-1">
        <app-language-selector />
        <app-currency-selector />

        @if (session.usuario(); as usuario) {
          <button
            type="button"
            class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-sm hover:bg-surface-muted"
            data-track="cuenta.abrir"
            [cdkMenuTriggerFor]="cuentaMenu"
            [attr.aria-label]="('header.account' | transloco) + ': ' + usuario.nombres"
          >
            <app-icon name="cuenta" />
            <span class="hidden max-w-32 truncate lg:inline">{{ usuario.nombres }}</span>
          </button>
          <ng-template #cuentaMenu>
            <div cdkMenu class="min-w-48 rounded-card border border-border bg-surface p-1 shadow-overlay">
              <div class="px-3 py-2">
                <p class="truncate text-sm font-semibold">{{ usuario.nombres }} {{ usuario.apellidos }}</p>
                <p class="truncate text-xs text-muted">{{ usuario.email }}</p>
              </div>
              <a cdkMenuItem routerLink="/cuenta/pedidos" data-track="cuenta.mis-pedidos" class="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-surface-muted focus:bg-surface-muted">
                <app-icon name="producto" [size]="18" /> {{ 'header.orders' | transloco }}
              </a>
              @if (usuario.rol === 'admin') {
                <a cdkMenuItem routerLink="/admin" class="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-surface-muted focus:bg-surface-muted">
                  <app-icon name="panel" [size]="18" /> {{ 'header.admin' | transloco }}
                </a>
              }
              <button cdkMenuItem type="button" class="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm hover:bg-surface-muted focus:bg-surface-muted" (cdkMenuItemTriggered)="logout.cerrar()">
                <app-icon name="salir" [size]="18" /> {{ 'header.logout' | transloco }}
              </button>
            </div>
          </ng-template>
        } @else {
          <a
            routerLink="/auth/login"
            [queryParams]="{ volver: historial.ultima() === '/' ? null : historial.ultima() }"
            [state]="{ origen: 'encabezado' }"
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted"
            data-track="cuenta.login"
            [attr.aria-label]="'header.login' | transloco"
          >
            <app-icon name="cuenta" />
          </a>
        }

        <!-- Siempre visible, también en el celular (CA-1.5, H1). -->
        <a
          routerLink="/carrito"
          data-zone="carrito"
          data-track="carrito.abrir"
          class="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-sm hover:bg-surface-muted"
          [attr.aria-label]="cantidad() === 0 ? ('header.cart' | transloco) : cantidad() === 1 ? ('header.cartCountOne' | transloco) : ('header.cartCount' | transloco: { n: cantidad() })"
        >
          <app-icon name="carrito" />
          <span class="hidden lg:inline">{{ 'header.cart' | transloco }}</span>
          @if (cantidad() > 0) {
            <span class="absolute -top-0.5 -right-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground" aria-hidden="true">{{ cantidad() }}</span>
          }
        </a>
      </div>
    </div>

    <nav class="hidden border-t border-border md:block" data-zone="categorias" [attr.aria-label]="'header.categories' | transloco">
      <ul class="mx-auto flex max-w-7xl gap-1 px-4">
        @for (grupo of categorias(); track grupo.categoria.slug) {
          <!-- ponytail: el submenú se abre con :hover y :focus-within (sin Esc). Si el APF3 exige cerrarlo con Esc (WCAG 1.4.13), pasar a cdkMenuBar. -->
          <li class="group relative">
            <a
              class="inline-flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-muted"
              routerLinkActive="font-semibold text-primary"
              [routerLink]="['/catalogo', grupo.categoria.slug]"
              [attr.data-track]="'categorias.' + grupo.categoria.slug"
            >{{ grupo.categoria.clave_i18n | transloco }}</a>
            @if (grupo.hijas.length) {
              <ul class="invisible absolute top-full left-0 z-40 min-w-56 rounded-card border border-border bg-surface p-1 opacity-0 shadow-overlay group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                @for (hija of grupo.hijas; track hija.slug) {
                  <li>
                    <a
                      class="flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-muted focus:bg-surface-muted"
                      [routerLink]="['/catalogo', hija.slug]"
                      [attr.data-track]="'categorias.' + hija.slug"
                    >{{ hija.clave_i18n | transloco }}</a>
                  </li>
                }
              </ul>
            }
          </li>
        }
        <li>
          <a routerLink="/armador" routerLinkActive="font-semibold text-primary" data-track="armador.abrir" class="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-primary hover:bg-surface-muted">{{ 'builder.nav' | transloco }}</a>
        </li>
      </ul>
    </nav>
  `,
})
export class Header {
  protected readonly session = inject(SessionApi);
  protected readonly logout = inject(LogoutService);
  protected readonly historial = inject(NavigationHistory);
  protected readonly categorias = toSignal(inject(CatalogApi).categoriasConHijas(), { initialValue: [] });
  protected readonly cantidad = inject(CartApi).cantidadTotal;
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  protected abrirMenu(): void {
    this.dialog.open(MobileMenu, {
      positionStrategy: this.overlay.position().global().left('0').top('0'),
      height: '100%',
      width: 'min(20rem, 85vw)',
    });
  }
}
