import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleQuestionMark, CircleX, Copy, CreditCard, Lock, Smartphone, Cpu, Globe, Info, Laptop, LayoutDashboard, LogOut, LucideAngularModule, Menu,
  Monitor, Mouse, Package, PackageCheck, PackageX, Search, SearchX, ShoppingCart, SlidersHorizontal, Trash2, TriangleAlert, Truck, User, Wrench, X,
} from 'lucide-angular';

/**
 * Set único de iconos (constitución P2). Significados fijos, no se reasignan.
 * Los de la segunda parte NO son estándar: siempre van acompañados de texto visible (H2).
 * Favoritos (corazón) está reservado y no se incluye.
 */
const ICONOS = {
  carrito: ShoppingCart,
  buscar: Search,
  cuenta: User,
  menu: Menu,
  eliminar: Trash2,
  cerrar: X,
  compatible: CircleCheck,
  incompatible: CircleX,
  sinConfirmar: CircleQuestionMark,
  advertencia: TriangleAlert,
  // — solo con texto visible —
  idioma: Globe,
  desplegar: ChevronDown,
  volver: ArrowLeft,
  envio: Truck,
  panel: LayoutDashboard,
  salir: LogOut,
  disponible: PackageCheck,
  agotado: PackageX,
  copiar: Copy,
  copiado: Check,
  anterior: ChevronLeft,
  siguiente: ChevronRight,
  vacio: SearchX,
  producto: Package,
  info: Info,
  filtrar: SlidersHorizontal,
  tarjeta: CreditCard,
  candado: Lock,
  celular: Smartphone,
  // — categorías raíz (tarjetas del inicio, siempre con su nombre) —
  cpu: Cpu,
  laptop: Laptop,
  pantalla: Monitor,
  repuesto: Wrench,
  periferico: Mouse,
} as const;

export type IconName = keyof typeof ICONOS;

/**
 * Decorativo por defecto (`aria-hidden`), porque el texto o el `aria-label` lo lleva el botón que lo contiene.
 * Si el icono transmite información por sí solo, se pasa `label`.
 */
@Component({
  selector: 'app-icon',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() ?? null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `<lucide-icon [img]="data()" [size]="size()" />`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly label = input<string>();
  protected readonly data = computed(() => ICONOS[this.name()]);
}
