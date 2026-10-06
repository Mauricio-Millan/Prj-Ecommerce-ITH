import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { SessionApi } from '../auth/session.api';
import { CatalogApi } from '../catalog/catalog.api';
import { ToastService } from '../../shared/ui/toast/toast';
import { Producto } from '../catalog/catalog.models';
import { Estado } from '../compat/compat.logic';
import { MiEquipoService } from '../compat/mi-equipo.service';
import { localStore } from '../storage/local-store';
import { InteractionLogger } from '../telemetry/interaction-logger';
import { AddToCart } from './add-to-cart';
import { CartApi } from './cart.api';

const bateria = { id: 3, sku: 'BAT-L17C3PF1', stock: 5 } as Producto;

describe('AddToCart con compatibilidad (spec 003, plan § 5.1)', () => {
  let estado: Estado | null;
  let toast: ToastService;
  let cart: CartApi;
  let eventos: { tipo: string; datos?: Record<string, unknown> }[];
  let router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };

  beforeEach(() => {
    localStore.remove('carrito');
    estado = null;
    eventos = [];
    router = { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: SessionApi, useValue: { usuario: () => null } },
        { provide: CatalogApi, useValue: { todos: () => of([]) } },
        { provide: InteractionLogger, useValue: { track: (tipo: string, datos?: Record<string, unknown>) => eventos.push({ tipo, datos }) } },
        {
          provide: MiEquipoService,
          useValue: {
            evaluar: () => (estado ? { estado, nivel: 'lista' } : null),
            nombre: () => 'Lenovo IdeaPad 3 15ITL6',
            slugSubcategoria: () => 'baterias',
          },
        },
      ],
    });
    toast = TestBed.inject(ToastService);
    cart = TestBed.inject(CartApi);
  });
  afterEach(() => localStore.remove('carrito'));

  const agregar = () => TestBed.inject(AddToCart).agregar(bateria, 1, 'ficha');
  const addToCart = () => eventos.find((e) => e.tipo === 'add_to_cart')!.datos!;

  it('un producto no compatible se agrega, avisa con advertencia de 10 s y registra compatible: false', () => {
    estado = 'incompatible';
    agregar();

    expect(cart.cantidadTotal()).toBe(1);
    const aviso = toast.avisos()[0];
    expect([aviso.clave, aviso.tipo]).toEqual(['compat.warning', 'advertencia']);
    expect(aviso.acciones.map((a) => a.clave)).toEqual(['cart.undo', 'compat.seeCompatibleShort']);
    expect(addToCart()['compatible']).toBeFalse();
  });

  it('"Deshacer" quita el producto y registra la decisión', () => {
    estado = 'incompatible';
    agregar();
    const aviso = toast.avisos()[0];
    toast.usar(aviso, aviso.acciones[0]);

    expect(cart.cantidadTotal()).toBe(0);
    expect(eventos.filter((e) => e.tipo === 'compat_warning').map((e) => e.datos)).toEqual([{ sku: 'BAT-L17C3PF1', decision: 'deshacer' }]);
  });

  it('"Ver compatibles" abre la misma subcategoría con compat=1', () => {
    estado = 'incompatible';
    agregar();
    const aviso = toast.avisos()[0];
    toast.usar(aviso, aviso.acciones[1]);

    expect(router.navigate).toHaveBeenCalledWith(['/catalogo', 'baterias'], { queryParams: { compat: 1 } });
    expect(eventos.find((e) => e.tipo === 'compat_warning')!.datos!['decision']).toBe('ver_compatibles');
  });

  it('si el aviso se cierra sin usar una acción, la decisión es "ignorar"', () => {
    estado = 'incompatible';
    agregar();
    toast.cerrar(toast.avisos()[0].id);
    expect(eventos.find((e) => e.tipo === 'compat_warning')!.datos!['decision']).toBe('ignorar');
  });

  it('compatible → aviso normal; sin datos → "revisa que sea compatible"; sin equipo → compatible: null', () => {
    estado = 'compatible';
    agregar();
    expect([toast.avisos()[0].clave, addToCart()['compatible']]).toEqual(['cart.added', true]);

    estado = 'sin_datos';
    agregar();
    expect(toast.avisos()[1].clave).toBe('compat.addedCheck');

    eventos = [];
    estado = null;
    agregar();
    expect(addToCart()['compatible']).toBeNull();
    expect(toast.avisos()[2].clave).toBe('cart.added');
  });
});
