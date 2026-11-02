import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { inventarioSinConfirmarGuard } from './pages/admin/inventario/inventario.guard';
import { productoSinGuardarGuard } from './pages/admin/producto-form/producto-form.guard';
import { authGuard } from './core/auth/auth.guard';
import { invitadoGuard } from './core/auth/invitado.guard';
import { carritoPagableGuard, sinProcesarGuard } from './core/cart/carrito-pagable.guard';
import { AdminLayout } from './layouts/admin-layout/admin-layout';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { CheckoutLayout } from './layouts/checkout-layout/checkout-layout';
import { StoreLayout } from './layouts/store-layout/store-layout';

export const routes: Routes = [
  {
    path: '',
    component: StoreLayout,
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home/home') },
      { path: 'buscar', loadComponent: () => import('./pages/buscar/buscar') },
      { path: 'ayuda', loadComponent: () => import('./pages/ayuda/ayuda') },
      { path: 'accesibilidad', loadComponent: () => import('./pages/accesibilidad/accesibilidad') },
      { path: 'carrito', loadComponent: () => import('./pages/carrito/carrito') },
      { path: 'armador', loadComponent: () => import('./pages/armador/armador').then((m) => m.Armador) },
      { path: 'catalogo/:slug', loadComponent: () => import('./pages/categoria/categoria') },
      { path: 'cuenta/pedidos', canActivate: [authGuard], data: { privada: true }, loadComponent: () => import('./pages/cuenta/pedidos/pedidos').then((m) => m.Pedidos) },
      { path: 'cuenta/pedidos/:codigo', canActivate: [authGuard], data: { privada: true }, loadComponent: () => import('./pages/cuenta/pedido-detalle/pedido-detalle').then((m) => m.PedidoDetalle) },
      // La spec 012 agrupa las fichas como `/producto/:sku`.
      { path: 'producto/:sku', loadComponent: () => import('./pages/producto/producto') },
    ],
  },
  {
    path: 'checkout',
    component: CheckoutLayout,
    canActivate: [authGuard],
    data: { privada: true },
    children: [{ path: '', canActivate: [carritoPagableGuard], canDeactivate: [sinProcesarGuard], loadComponent: () => import('./pages/checkout/checkout') }],
  },
  {
    path: 'pedido/:codigo/confirmado',
    component: CheckoutLayout,
    canActivate: [authGuard],
    data: { privada: true },
    children: [{ path: '', loadComponent: () => import('./pages/pedido-confirmado/pedido-confirmado') }],
  },
  {
    path: 'auth',
    component: AuthLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', canActivate: [invitadoGuard], loadComponent: () => import('./pages/auth/login/login') },
      { path: 'registro', canActivate: [invitadoGuard], loadComponent: () => import('./pages/auth/registro/registro') },
      { path: 'recuperar', loadComponent: () => import('./pages/auth/recuperar/recuperar') },
    ],
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [adminGuard],
    data: { privada: true }, // al cerrar sesión aquí se vuelve al inicio (spec 004, CA-4.2)
    children: [
      { path: '', loadComponent: () => import('./pages/admin/dashboard/dashboard') },
      { path: 'productos', loadComponent: () => import('./pages/admin/productos/productos') },
      { path: 'productos/nuevo', canDeactivate: [productoSinGuardarGuard], loadComponent: () => import('./pages/admin/producto-form/producto-form') },
      { path: 'productos/:sku', canDeactivate: [productoSinGuardarGuard], loadComponent: () => import('./pages/admin/producto-form/producto-form') },
      { path: 'equipos', loadComponent: () => import('./pages/admin/equipos/equipos') },
      { path: 'tipo-cambio', loadComponent: () => import('./pages/admin/tipo-cambio/tipo-cambio') },
      { path: 'pedidos', loadComponent: () => import('./pages/admin/pedidos/pedidos') },
      { path: 'pedidos/:codigo', loadComponent: () => import('./pages/admin/pedido-admin/pedido-admin') },
      { path: 'inventario', canDeactivate: [inventarioSinConfirmarGuard], loadComponent: () => import('./pages/admin/inventario/inventario') },
    ],
  },
  {
    path: '**',
    component: StoreLayout,
    children: [{ path: '', loadComponent: () => import('./pages/not-found/not-found') }],
  },
];
