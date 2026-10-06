import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DireccionesApi, Direccion } from '../../core/account/direcciones.api';
import { PerfilApi } from '../../core/account/perfil.api';
import { SessionApi } from '../../core/auth/session.api';
import { CartApi } from '../../core/cart/cart.api';
import { detallar, resumen as calcularResumen } from '../../core/cart/cart.logic';
import { CatalogApi } from '../../core/catalog/catalog.api';
import { Producto } from '../../core/catalog/catalog.models';
import { UbigeoApi } from '../../core/checkout/ubigeo.api';
import { CurrencyService } from '../../core/currency/currency.service';
import { LanguageService } from '../../core/i18n/language.service';
import { tituloDePagina } from '../../core/i18n/page-title';
import { OrdersApi } from '../../core/orders/orders.api';
import { Envio, MetodoPago, Pedido, ResultadoPago } from '../../core/orders/orders.models';
import { InteractionLogger } from '../../core/telemetry/interaction-logger';
import { Viewport } from '../../core/ui/viewport';
import { cambios } from '../../core/validation/form-state';
import { celularPe, codigoYape, cvv, dni, tarjetaLuhn, vencimiento } from '../../core/validation/validators';
import { ErrorResumen, FormErrorSummary } from '../../shared/ui/form-error-summary/form-error-summary';
import { OrderSummary } from '../../shared/ui/order-summary/order-summary';
import { formatear } from '../../shared/ui/price/price';
import { Stepper, Paso } from '../../shared/ui/stepper/stepper';
import { AddressForm } from './address-form/address-form';
import { AddressPicker, OpcionDireccion } from './address-picker/address-picker';
import { BoletaData } from './boleta-data/boleta-data';
import { CardForm } from './card-form/card-form';
import { PayButton } from './pay-button/pay-button';
import { PaymentMethod } from './payment-method/payment-method';
import { PaymentResultBanner, ResultadoBanner } from './payment-result-banner/payment-result-banner';
import { YapeForm } from './yape-form/yape-form';

const PASOS: Paso[] = [{ clave: 'checkout.stepShipping', track: 'checkout.paso-envio' }, { clave: 'checkout.stepPayment', track: 'checkout.paso-pago' }];

/** Campos del envío en el orden de la pantalla: el resumen de errores y el foco siguen este orden (CA-2.4). */
const CAMPOS_ENVIO = [
  { nombre: 'departamento', id: 'envio-departamento', etiquetaClave: 'ubigeo.department' },
  { nombre: 'provincia', id: 'envio-provincia', etiquetaClave: 'ubigeo.province' },
  { nombre: 'ubigeo_id', id: 'envio-distrito', etiquetaClave: 'ubigeo.district' },
  { nombre: 'direccion', id: 'envio-direccion', etiquetaClave: 'checkout.address' },
  { nombre: 'destinatario', id: 'envio-destinatario', etiquetaClave: 'checkout.recipient' },
  { nombre: 'telefono', id: 'envio-telefono', etiquetaClave: 'checkout.phone' },
];

/**
 * Checkout (spec 006): dos pasos, "Envío" y "Revisión y pago". Contenedor: coordina los formularios, el pedido y el pago.
 * No guarda nunca datos de tarjeta ni de Yape (CA-4.6): viajan solo hasta el simulador.
 */
@Component({
  selector: 'app-checkout',
  imports: [
    ReactiveFormsModule, TranslocoPipe, Stepper, FormErrorSummary, AddressPicker, AddressForm, BoletaData, OrderSummary, PaymentMethod, CardForm,
    YapeForm, PayButton, PaymentResultBanner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div (focusout)="alSalirDeCampo($event)">
      <app-stepper [pasos]="pasos" [actual]="paso()" (ir)="irAPaso($event)" />
      <h1 id="checkout-titulo" tabindex="-1" class="mt-4 text-2xl font-bold outline-none">{{ pasos[paso()].clave | transloco }}</h1>

      @if (paso() === 0) {
        <div class="mt-4 grid max-w-2xl gap-6">
          <app-form-error-summary [errores]="resumen1()" />

          @if (opcionesDirecciones().length) {
            <app-address-picker [direcciones]="opcionesDirecciones()" [seleccion]="seleccionDireccion()" (seleccionar)="seleccionDireccion.set($event)" />
          }
          @if (seleccionDireccion() === 'nueva') {
            <app-address-form [form]="envioForm" [ubigeos]="ubigeos()" [intentado]="intentado1()" />
          }

          <app-boleta-data [titular]="titular()" [control]="dni" [dniGuardado]="usuario()?.dni ?? null" [intentado]="intentado1()" />

          <button
            type="button"
            data-zone="cta-principal"
            data-track="cta-principal.continuar"
            class="min-h-12 rounded-control bg-accent px-6 font-semibold text-accent-foreground hover:opacity-90 sm:justify-self-start"
            (click)="continuar()"
          >{{ 'checkout.continue' | transloco }}</button>
        </div>
      } @else if (pedido(); as p) {
        <div class="mt-4 grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
          <div class="grid content-start gap-5">
            @if (movil()) {
              <details class="rounded-card border border-border bg-surface">
                <summary class="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">{{ 'checkout.viewSummary' | transloco: { monto: totalTexto() } }}</summary>
                <div class="p-2"><app-order-summary [pedido]="p" [moneda]="moneda()" [editable]="!procesando()" (cambiar)="irAPaso(0)" /></div>
              </details>
            }

            <app-payment-method [metodo]="metodo()" [deshabilitado]="procesando()" (cambiar)="cambiarMetodo($event)" />

            @if (metodo() === 'tarjeta') {
              <app-card-form [form]="tarjeta" [intentado]="intentado2()" />
            } @else {
              <app-yape-form [form]="yape" [intentado]="intentado2()" />
            }

            <app-payment-result-banner [resultado]="resultado()" (reintentar)="pagar()" (ajustar)="irAlCarrito()" />
            <app-pay-button [monto]="totalTexto()" [metodo]="metodo()" [procesando]="procesando()" (pagar)="pagar()" />
          </div>

          @if (!movil()) {
            <aside><app-order-summary [pedido]="p" [moneda]="moneda()" [editable]="!procesando()" (cambiar)="irAPaso(0)" /></aside>
          }
        </div>
      }
    </div>
  `,
})
export default class Checkout {
  private readonly session = inject(SessionApi);
  private readonly cart = inject(CartApi);
  private readonly catalog = inject(CatalogApi);
  private readonly currency = inject(CurrencyService);
  private readonly orders = inject(OrdersApi);
  private readonly perfil = inject(PerfilApi);
  private readonly direccionesApi = inject(DireccionesApi);
  private readonly router = inject(Router);
  private readonly logger = inject(InteractionLogger);
  private readonly lang = inject(LanguageService).lang;
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly banner = viewChild(PaymentResultBanner);
  protected readonly movil = inject(Viewport).movil;
  protected readonly pasos = PASOS;

  protected readonly usuario = this.session.usuario;
  protected readonly titular = computed(() => `${this.usuario()?.nombres ?? ''} ${this.usuario()?.apellidos ?? ''}`.trim());
  protected readonly ubigeos = toSignal(inject(UbigeoApi).todos(), { initialValue: [] });
  private readonly productos = toSignal(this.catalog.todos(), { initialValue: [] as readonly Producto[] });

  // ── Estado ──
  protected readonly paso = signal(0);
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly intentado1 = signal(false);
  protected readonly intentado2 = signal(false);
  /** Público: el guard `canDeactivate` impide salir mientras se procesa el pago (CA-4.4). */
  readonly procesando = signal(false);
  protected readonly resultado = signal<ResultadoBanner | null>(null);
  private intento = 0;
  private readonly yaReportados = new Set<string>();

  // ── Formularios ──
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly envioForm = this.fb.group({
    departamento: ['', Validators.required],
    provincia: ['', Validators.required],
    ubigeo_id: ['', Validators.required],
    direccion: ['', Validators.required],
    referencia: [''],
    destinatario: [this.titular(), Validators.required],
    telefono: [this.usuario()?.telefono ?? '', [Validators.required, celularPe]],
    guardar: [true],
  });
  protected readonly dni = this.fb.control(this.usuario()?.dni ?? '', [Validators.required, dni]);
  protected readonly tarjeta = this.fb.group({
    numero: ['', [Validators.required, tarjetaLuhn]],
    titular: ['', Validators.required],
    vencimiento: ['', [Validators.required, vencimiento()]],
    cvv: ['', [Validators.required, cvv]],
  });
  protected readonly yape = this.fb.group({ celular: ['', [Validators.required, celularPe]], codigo: ['', [Validators.required, codigoYape]] });
  protected readonly metodo = signal<MetodoPago>(this.perfil.ultimoMetodo(this.usuario()!.id) ?? 'tarjeta');

  private readonly versionEnvio = cambios(this.envioForm);
  private readonly versionDni = cambios(this.dni);

  // ── Direcciones guardadas ──
  private readonly direcciones = signal<Direccion[]>(this.direccionesApi.listar(this.usuario()!.id));
  protected readonly seleccionDireccion = signal<string>(this.direcciones().find((d) => d.es_principal)?.id ?? this.direcciones()[0]?.id ?? 'nueva');
  protected readonly opcionesDirecciones = computed<OpcionDireccion[]>(() =>
    this.direcciones().map((d) => {
      const u = this.ubigeos().find((x) => x.id === d.ubigeo_id);
      return { id: d.id, destinatario: d.destinatario, principal: d.es_principal, texto: `${d.direccion}, ${u?.distrito ?? ''}, ${u?.provincia ?? ''}` };
    }),
  );

  // ── Montos ──
  protected readonly moneda = computed(() => this.currency.currency());
  private readonly tc = computed(() => (this.currency.exchangeRate() ? Number(this.currency.exchangeRate()!.valor) : null));
  private readonly lineas = computed(() => detallar(this.cart.items(), this.productos(), this.tc()));
  protected readonly totalTexto = computed(() => formatear(this.pedido()?.total_pen_centimos ?? 0, 'PEN', this.lang()));

  /** Los campos con error del paso 1, en el orden de la pantalla (CA-2.4). */
  private camposPaso1(): { id: string; etiquetaClave: string; control: AbstractControl; nombre: string }[] {
    const envio = this.seleccionDireccion() === 'nueva' ? CAMPOS_ENVIO.map((c) => ({ ...c, control: this.envioForm.get(c.nombre)! })) : [];
    return [...envio, { nombre: 'dni', id: 'boleta-dni', etiquetaClave: 'checkout.dni', control: this.dni }];
  }

  protected readonly resumen1 = computed<ErrorResumen[]>(() => {
    this.versionEnvio();
    this.versionDni();
    this.seleccionDireccion();
    if (!this.intentado1()) return [];
    return this.camposPaso1().filter((c) => c.control.invalid).map(({ id, etiquetaClave }) => ({ id, etiquetaClave }));
  });

  constructor() {
    tituloDePagina('checkout.pageTitle');
    // Al entrar se pone el carrito al día; si ya no se puede pagar, vuelve al carrito (CA-1.2).
    this.cart.reconciliar();
    this.currency.init().subscribe();
    this.logger.track('checkout_step', { paso: 1, accion: 'entrar' });
  }

  // ───────────── navegación entre pasos ─────────────

  protected irAPaso(i: number): void {
    if (i >= this.paso() || this.procesando()) return;
    this.paso.set(i);
    this.logger.track('checkout_step', { paso: i + 1, accion: 'editar' });
    this.enfocarTitulo();
  }

  private enfocarTitulo(): void {
    afterNextRender(() => this.document.getElementById('checkout-titulo')?.focus(), { injector: this.injector });
  }

  protected irAlCarrito(): void {
    this.router.navigateByUrl('/carrito');
  }

  // ───────────── paso 1: envío y boleta ─────────────

  protected continuar(): void {
    this.intentado1.set(true);
    const nueva = this.seleccionDireccion() === 'nueva';
    if (nueva) this.envioForm.markAllAsTouched();
    this.dni.markAsTouched();

    const invalidos = this.camposPaso1().filter((c) => c.control.invalid);
    if (invalidos.length) {
      for (const c of invalidos) this.registrarError(c.nombre, c.control);
      this.document.getElementById(invalidos[0].id)?.focus();
      return;
    }

    const u = this.usuario()!;
    const numero = this.dni.value.trim();
    if (numero !== u.dni) this.perfil.guardarDni(u.id, numero);

    const envio = nueva ? this.envioNuevo(u.id) : this.envioGuardado();
    if (!envio || this.tc() === null) return;
    // Una vez guardado el DNI, el usuario de la sesión ya lo trae: el comprobante sale con él.
    const pedido = this.orders.prepararPedido(this.lineas(), this.tc()!, this.session.usuario()!, envio);
    this.pedido.set(pedido);
    if (!this.yape.controls.celular.value) this.yape.controls.celular.setValue(envio.telefono);
    if (!this.tarjeta.controls.titular.value) this.tarjeta.controls.titular.setValue('');

    this.logger.track('checkout_step', { paso: 1, accion: 'completar' });
    this.logger.track('checkout_step', { paso: 2, accion: 'entrar' });
    this.paso.set(1);
    this.enfocarTitulo();
  }

  private envioGuardado(): Envio | null {
    const d = this.direcciones().find((x) => x.id === this.seleccionDireccion());
    return d ? this.armarEnvio(d) : null;
  }

  private envioNuevo(usuarioId: string): Envio | null {
    const v = this.envioForm.getRawValue();
    const datos = { ubigeo_id: v.ubigeo_id, direccion: v.direccion.trim(), referencia: v.referencia.trim(), destinatario: v.destinatario.trim(), telefono: v.telefono.trim() };
    if (v.guardar) {
      const nueva = this.direccionesApi.guardar(usuarioId, datos);
      this.direcciones.set(this.direccionesApi.listar(usuarioId));
      this.seleccionDireccion.set(nueva.id);
    }
    return this.armarEnvio(datos);
  }

  private armarEnvio(d: Pick<Direccion, 'ubigeo_id' | 'direccion' | 'referencia' | 'destinatario' | 'telefono'>): Envio | null {
    const u = this.ubigeos().find((x) => x.id === d.ubigeo_id);
    return u ? { ...d, departamento: u.departamento, provincia: u.provincia, distrito: u.distrito } : null;
  }

  // ───────────── paso 2: pago ─────────────

  protected cambiarMetodo(m: MetodoPago): void {
    if (this.procesando() || m === this.metodo()) return;
    this.metodo.set(m);
    this.resultado.set(null);
    this.logger.track('payment_method', { metodo: m });
  }

  protected pagar(): void {
    if (this.procesando() || !this.pedido()) return;
    const metodo = this.metodo();
    const form = metodo === 'tarjeta' ? this.tarjeta : this.yape;
    this.intentado2.set(true);
    form.markAllAsTouched();
    if (form.invalid) {
      // Solo el nombre del campo y el tipo de error: nunca lo escrito (CA-4.6).
      for (const [nombre, c] of Object.entries(form.controls)) this.registrarError(nombre, c);
      const primero = Object.entries(form.controls).find(([, c]) => c.invalid)?.[0];
      const id = metodo === 'tarjeta' ? { numero: 'pago-numero', titular: 'pago-titular', vencimiento: 'pago-vencimiento', cvv: 'pago-cvv' }[primero ?? ''] : { celular: 'pago-yape-celular', codigo: 'pago-yape-codigo' }[primero ?? ''];
      if (id) this.document.getElementById(id)?.focus();
      return;
    }

    this.procesando.set(true);
    this.resultado.set(null);
    this.intento++;
    const dato = metodo === 'tarjeta' ? { numero: this.tarjeta.controls.numero.value } : { codigo: this.yape.controls.codigo.value };
    const ultimos4 = metodo === 'tarjeta' ? this.tarjeta.controls.numero.value.replace(/\s/g, '').slice(-4) : undefined;

    this.orders.pagar(this.pedido()!.codigo, metodo, dato).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.alResultado(r, metodo, ultimos4);
      },
      error: () => this.procesando.set(false),
    });
  }

  private alResultado(r: ResultadoPago, metodo: MetodoPago, ultimos4?: string): void {
    const medido = r.tipo === 'aprobado' || r.tipo === 'rechazado' || r.tipo === 'sin_respuesta' ? r.tipo : r.tipo === 'SIN_STOCK' ? 'sin_stock' : null;
    if (medido) this.logger.track('payment_result', { metodo, resultado: medido, intento: this.intento });

    switch (r.tipo) {
      case 'aprobado': {
        // Los 4 últimos dígitos viajan solo en el estado de la navegación (no se guardan); los formularios de pago se limpian (CA-4.6, 6.1).
        const codigo = r.pedido.codigo;
        this.tarjeta.reset();
        this.yape.reset();
        this.router.navigate(['/pedido', codigo, 'confirmado'], { state: { ultimos4, metodo } });
        return;
      }
      case 'rechazado':
        // El número o el código se borran; los datos de envío se conservan (CA-5.2).
        this.tarjeta.patchValue({ numero: '', cvv: '' });
        this.yape.patchValue({ codigo: '' });
        this.tarjeta.markAsUntouched();
        this.yape.markAsUntouched();
        this.intentado2.set(false);
        this.resultado.set({ tipo: 'rechazado', metodo });
        break;
      case 'sin_respuesta':
        this.resultado.set({ tipo: 'sin_respuesta' });
        break;
      case 'SIN_STOCK':
        this.resultado.set({ tipo: 'SIN_STOCK', faltantes: r.faltantes });
        break;
      case 'TOTAL_CAMBIO':
        this.alTotalCambiado(r.antes, r.despues);
        break;
      case 'NO_ENCONTRADO':
        this.irAlCarrito();
        return;
    }
    afterNextRender(() => this.banner()?.enfocar(), { injector: this.injector });
  }

  /** Cambió el tipo de cambio o un precio: no se cobró. Se actualiza el resumen y se pide confirmar de nuevo (CA-3.4). */
  private alTotalCambiado(antes: number, despues: number): void {
    this.currency.init().subscribe(() => {
      if (!calcularResumen(this.lineas()).puedePagar || this.tc() === null) {
        this.irAlCarrito();
        return;
      }
      const vigente = this.pedido()!;
      this.pedido.set(this.orders.prepararPedido(this.lineas(), this.tc()!, this.session.usuario()!, vigente.envio));
      this.resultado.set({ tipo: 'TOTAL_CAMBIO', antes: formatear(antes, 'PEN', this.lang()), despues: formatear(despues, 'PEN', this.lang()) });
      afterNextRender(() => this.banner()?.enfocar(), { injector: this.injector });
    });
  }

  // ───────────── medición de errores de formulario (sin valores) ─────────────

  private registrarError(campo: string, control: AbstractControl): void {
    const codigo = Object.keys(control.errors ?? {})[0];
    if (codigo) this.logger.track('form_error', { campo, codigo });
  }

  /** Al salir de un campo inválido se registra el campo y el tipo de error, una vez (CA-7.2). */
  protected alSalirDeCampo(e: FocusEvent): void {
    const id = (e.target as HTMLElement | null)?.id;
    if (!id) return;
    const control = this.controlPorId(id);
    if (!control || !control.invalid) return;
    const codigo = Object.keys(control.errors ?? {})[0];
    if (this.yaReportados.has(`${id}:${codigo}`)) return;
    this.yaReportados.add(`${id}:${codigo}`);
    this.logger.track('form_error', { campo: id, codigo });
  }

  private controlPorId(id: string): AbstractControl | null {
    const envio = CAMPOS_ENVIO.find((c) => c.id === id);
    if (envio) return this.envioForm.get(envio.nombre);
    return (
      ({ 'boleta-dni': this.dni, 'pago-numero': this.tarjeta.get('numero'), 'pago-titular': this.tarjeta.get('titular'), 'pago-vencimiento': this.tarjeta.get('vencimiento'), 'pago-cvv': this.tarjeta.get('cvv'), 'pago-yape-celular': this.yape.get('celular'), 'pago-yape-codigo': this.yape.get('codigo') } as Record<string, AbstractControl | null>)[id] ?? null
    );
  }
}
