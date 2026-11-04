import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LogoutService } from '../../../core/auth/logout.service';
import { SessionApi } from '../../../core/auth/session.api';
import { NavigationHistory } from '../../../core/auth/volver';
import { CartApi } from '../../../core/cart/cart.api';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { VoiceService } from '../../../core/voice/voice.service';
import { A11yPanel } from '../../../shared/ui/a11y-panel/a11y-panel';
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
  host: { class: 'block sticky top-0 z-30 border-b border-border bg-surface print:hidden', '(document:keydown.escape)': 'cerrarSubmenu()' },
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

      <a routerLink="/" class="rounded-control text-xl font-bold tracking-tight text-primary" data-track="logo.inicio">ByteZone</a>

      <app-search-box class="order-last w-full md:order-none md:max-w-xl md:flex-1" />


      <div class="ml-auto flex items-center sm:gap-1">
        @if (voz.disponible) {
          <button
            type="button"
            data-zone="voz"
            data-track="voz.hablar"
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control hover:bg-surface-muted"
            [class.bg-primary]="voz.estado() === 'escuchando'"
            [class.text-primary-foreground]="voz.estado() === 'escuchando'"
            [attr.aria-pressed]="voz.estado() === 'escuchando'"
            [attr.aria-label]="(voz.estado() === 'escuchando' ? 'voice.stop' : 'voice.button') | transloco"
            (click)="voz.alternar()"
          ><app-icon name="microfono" /></button>
        }
        <!-- Botón visible de accesibilidad: tema, contraste, colores para daltonismo y texto (spec 018, CA-5.12). -->
        <button
          type="button"
          data-zone="accesibilidad"
          data-track="accesibilidad.abrir"
          class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-sm hover:bg-surface-muted"
          [attr.aria-label]="'header.accessibility' | transloco"
          (click)="abrirAccesibilidad()"
        ><app-icon name="accesibilidad" /><span class="hidden lg:inline">{{ 'header.accessibility' | transloco }}</span></button>
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

        <!-- Siempre visible, también en el celular (CA-1.5, H1). El nombre sale del contenido visible ("Carrito 2 productos"),
             no de un aria-label: así contiene lo que se ve y el control por voz funciona (WCAG 2.5.3, 000 CA-1.7). -->
        <a
          routerLink="/carrito"
          data-zone="carrito"
          data-track="carrito.abrir"
          class="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-sm hover:bg-surface-muted"
        >
          <app-icon name="carrito" />
          <span class="sr-only lg:not-sr-only">{{ 'header.cart' | transloco }}</span>
          @if (cantidad() > 0) {
            <span class="absolute -top-0.5 -right-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground">{{ cantidad() }}</span>
            <span class="sr-only">{{ (cantidad() === 1 ? 'header.cartUnitOne' : 'header.cartUnits') | transloco }}</span>
          }
        </a>
      </div>
    </div>

    <nav class="hidden border-t border-border md:block" data-zone="categorias" [attr.aria-label]="'header.categories' | transloco">
      <ul class="mx-auto flex max-w-7xl gap-1 px-4">
        @for (grupo of categorias(); track grupo.categoria.slug) {
          <!-- El submenú se abre con :hover y :focus-within; Esc lo oculta hasta que el puntero o el foco salen del grupo (WCAG 1.4.13, 001 CA-2.5). -->
          <li class="group relative" (mouseenter)="submenuOculto.set(false)" (mouseleave)="submenuOculto.set(false)" (focusin)="alCruzarGrupo($event)" (focusout)="alCruzarGrupo($event)">
            <a
              class="inline-flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-muted"
              routerLinkActive="font-semibold text-primary"
              [routerLink]="['/catalogo', grupo.categoria.slug]"
              [attr.data-track]="'categorias.' + grupo.categoria.slug"
            >{{ grupo.categoria.clave_i18n | transloco }}</a>
            @if (grupo.hijas.length) {
              <ul data-submenu [style.visibility]="submenuOculto() ? 'hidden' : null" class="invisible absolute top-full left-0 z-40 min-w-56 rounded-card border border-border bg-surface p-1 opacity-0 shadow-overlay group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
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
          <a routerLink="/armador" routerLinkActive="ring-2 ring-primary ring-offset-2" data-track="armador.abrir" class="my-1 inline-flex min-h-10 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'builder.nav' | transloco }}</a>
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
  protected readonly voz = inject(VoiceService);
  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly submenuOculto = signal(false);

  constructor() {
    // El encabezado está pegado arriba: su alto va a `scroll-padding-top` para que el foco no quede debajo (WCAG 2.4.11).
    const raiz = document.documentElement.style;
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const el = this.host.nativeElement;
      const medir = new ResizeObserver(() => raiz.setProperty('--alto-encabezado', `${el.offsetHeight}px`));
      medir.observe(el);
      destruir.onDestroy(() => {
        medir.disconnect();
        raiz.removeProperty('--alto-encabezado');
      });
    });
  }

  /** Esc oculta el submenú abierto por puntero o foco, sin mover ninguno de los dos (WCAG 1.4.13). */
  protected cerrarSubmenu(): void {
    this.submenuOculto.set(true);
    // Si el foco estaba dentro del submenú (que ahora se oculta), vuelve a su categoría.
    const activo = document.activeElement;
    const submenu = activo?.closest('[data-submenu]');
    if (submenu && this.host.nativeElement.contains(submenu)) submenu.parentElement?.querySelector<HTMLElement>(':scope > a')?.focus();
  }

  /** Al entrar o salir del grupo con el foco (no al moverse dentro de él), el submenú vuelve a poder abrirse. */
  protected alCruzarGrupo(evento: FocusEvent): void {
    const grupo = evento.currentTarget as HTMLElement;
    if (!grupo.contains(evento.relatedTarget as Node | null)) this.submenuOculto.set(false);
  }

  protected abrirAccesibilidad(): void {
    this.dialog.open(A11yPanel, { ariaLabelledBy: 'a11y-titulo' });
  }

  protected abrirMenu(): void {
    this.dialog.open(MobileMenu, {
      positionStrategy: this.overlay.position().global().left('0').top('0'),
      height: '100%',
      width: 'min(20rem, 85vw)',
    });
  }
}
