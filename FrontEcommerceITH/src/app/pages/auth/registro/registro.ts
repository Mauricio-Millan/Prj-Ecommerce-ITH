import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SessionApi } from '../../../core/auth/session.api';
import { NavigationHistory } from '../../../core/auth/volver';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { cambios, codigoDeError } from '../../../core/validation/form-state';
import { contrasenaSegura, correo } from '../../../core/validation/validators';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { ErrorResumen, FormErrorSummary } from '../../../shared/ui/form-error-summary/form-error-summary';
import { PasswordField } from '../../../shared/ui/password-field/password-field';
import { TermsDialog, TipoTexto } from '../../../shared/ui/terms-dialog/terms-dialog';
import { ToastService } from '../../../shared/ui/toast/toast';
import { PasswordRequirements } from './password-requirements/password-requirements';

/** Orden de los campos en pantalla: el resumen y el foco siguen este orden. */
const CAMPOS = [
  { nombre: 'nombres', id: 'registro-nombres', etiquetaClave: 'auth.firstName' },
  { nombre: 'apellidos', id: 'registro-apellidos', etiquetaClave: 'auth.lastName' },
  { nombre: 'email', id: 'registro-email', etiquetaClave: 'auth.email' },
  { nombre: 'contrasena', id: 'registro-contrasena', etiquetaClave: 'auth.password' },
  { nombre: 'acepto', id: 'registro-acepto', etiquetaClave: 'auth.accept.label' },
] as const;

/**
 * Crear cuenta (spec 004, HU-2): solo lo necesario (nombres, apellidos, correo y contraseña), con los requisitos de la contraseña
 * marcándose en tiempo real. Al terminar inicia sesión sola y vuelve a donde el usuario estaba (H3, H7).
 */
@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, PasswordField, FieldError, FormErrorSummary, PasswordRequirements],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-bold">{{ 'auth.register.title' | transloco }}</h1>

    @if (desdeCheckout()) {
      <p class="mt-3 rounded-control bg-surface-muted p-3 text-sm">{{ 'auth.checkoutContext' | transloco }}</p>
    }

    <form data-zone="formulario-cuenta" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="mt-4 grid gap-4">
      <app-form-error-summary [errores]="resumen()" />

      <div>
        <label for="registro-nombres" class="mb-1 block text-sm font-semibold">{{ 'auth.firstName' | transloco }}</label>
        <input id="registro-nombres" type="text" formControlName="nombres" autocomplete="given-name" [class]="err('nombres') ? campoError : campo" [attr.aria-invalid]="err('nombres') ? 'true' : null" [attr.aria-describedby]="err('nombres') ? 'registro-nombres-error' : null" />
        <app-field-error errorId="registro-nombres-error" [codigo]="err('nombres')" />
      </div>

      <div>
        <label for="registro-apellidos" class="mb-1 block text-sm font-semibold">{{ 'auth.lastName' | transloco }}</label>
        <input id="registro-apellidos" type="text" formControlName="apellidos" autocomplete="family-name" [class]="err('apellidos') ? campoError : campo" [attr.aria-invalid]="err('apellidos') ? 'true' : null" [attr.aria-describedby]="err('apellidos') ? 'registro-apellidos-error' : null" />
        <app-field-error errorId="registro-apellidos-error" [codigo]="err('apellidos')" />
      </div>

      <div>
        <label for="registro-email" class="mb-1 block text-sm font-semibold">{{ 'auth.email' | transloco }}</label>
        <input id="registro-email" type="email" formControlName="email" autocomplete="email" inputmode="email" [class]="err('email') ? campoError : campo" [attr.aria-invalid]="err('email') ? 'true' : null" [attr.aria-describedby]="err('email') ? 'registro-email-error' : null" />
        <app-field-error errorId="registro-email-error" [codigo]="err('email')">
          @if (err('email') === 'existe') {
            <a routerLink="/auth/login" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.ir-login" class="inline-flex min-h-11 items-center font-semibold text-primary underline">{{ 'auth.loginLink' | transloco }}</a>
          }
        </app-field-error>
      </div>

      <div>
        <label for="registro-contrasena" class="mb-1 block text-sm font-semibold">{{ 'auth.password' | transloco }}</label>
        <app-password-field inputId="registro-contrasena" formControlName="contrasena" autocomplete="new-password" [conError]="!!err('contrasena')" [describedBy]="'registro-requisitos' + (err('contrasena') ? ' registro-contrasena-error' : '')" />
        <app-field-error errorId="registro-contrasena-error" [codigo]="err('contrasena')" />
        <div id="registro-requisitos" class="mt-2"><app-password-requirements [valor]="contrasena()" /></div>
        <p class="mt-2 text-xs text-muted">{{ 'auth.prototypeNote' | transloco }}</p>
      </div>

      <div>
        <div class="flex items-start gap-2">
          <input id="registro-acepto" type="checkbox" formControlName="acepto" class="mt-2.5 size-5 accent-primary" [attr.aria-invalid]="err('acepto') ? 'true' : null" [attr.aria-describedby]="err('acepto') ? 'registro-acepto-error' : null" />
          <label for="registro-acepto" class="min-h-11 py-2 text-sm">
            {{ 'auth.accept.prefix' | transloco }}
            <button type="button" class="font-semibold text-primary underline" (click)="verTexto('terminos')">{{ 'auth.accept.terms' | transloco }}</button>
            {{ 'auth.accept.and' | transloco }}
            <button type="button" class="font-semibold text-primary underline" (click)="verTexto('privacidad')">{{ 'auth.accept.privacy' | transloco }}</button>
          </label>
        </div>
        <app-field-error errorId="registro-acepto-error" [codigo]="err('acepto') === 'required' ? 'aceptar' : err('acepto')" />
      </div>

      <button
        type="submit"
        data-zone="cta-principal"
        data-track="cuenta.registro"
        class="min-h-12 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        [disabled]="enviando()"
      >{{ (enviando() ? 'auth.register.submitting' : 'auth.register.submit') | transloco }}</button>
    </form>

    <p class="mt-4 text-sm">
      {{ 'auth.haveAccount' | transloco }}
      <a routerLink="/auth/login" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.ir-login" class="inline-flex min-h-11 items-center font-semibold text-primary underline">{{ 'auth.loginLink' | transloco }}</a>
    </p>
  `,
})
export default class Registro {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionApi);
  private readonly historial = inject(NavigationHistory);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(InteractionLogger);
  private readonly dialog = inject(Dialog);

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: [(history.state?.email as string | undefined) ?? '', [Validators.required, correo]],
    contrasena: ['', [Validators.required, contrasenaSegura]],
    acepto: [false, Validators.requiredTrue],
  });
  private readonly version = cambios(this.form);
  private readonly intentado = signal(false);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly volver = computed(() => this.query().get('volver'));
  protected readonly enviando = signal(false);
  protected readonly desdeCheckout = computed(() => (this.volver() ?? '').startsWith('/checkout'));
  private readonly origen = computed<'checkout' | 'encabezado' | 'otro'>(() =>
    this.desdeCheckout() ? 'checkout' : history.state?.origen === 'encabezado' ? 'encabezado' : 'otro',
  );
  /** Al pasar a "Inicia sesión" viaja el correo escrito (H6); solo en el estado de la navegación, nunca en la URL. */
  protected readonly estado = computed(() => (this.version(), { email: this.form.controls.email.value, origen: this.origen() }));
  protected readonly contrasena = computed(() => (this.version(), this.form.controls.contrasena.value));

  /** Los campos con error, en el orden de la pantalla (CA-2.6). */
  protected readonly resumen = computed<ErrorResumen[]>(() => {
    this.version();
    if (!this.intentado()) return [];
    return CAMPOS.filter((c) => this.form.controls[c.nombre].invalid).map(({ id, etiquetaClave }) => ({ id, etiquetaClave }));
  });

  constructor() {
    tituloDePagina('auth.register.title');
  }

  protected err(nombre: (typeof CAMPOS)[number]['nombre']): string | null {
    this.version();
    return codigoDeError(this.form.controls[nombre], this.intentado());
  }

  protected verTexto(tipo: TipoTexto): void {
    this.dialog.open(TermsDialog, { data: tipo, ariaLabelledBy: 'terminos-titulo' });
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.intentado.set(true);
    this.form.markAllAsTouched();

    const invalidos = CAMPOS.filter((c) => this.form.controls[c.nombre].invalid);
    if (invalidos.length) {
      // Solo el nombre del campo y el tipo de error: nunca lo escrito (CA-5.2).
      for (const c of invalidos) this.logger.track('form_error', { campo: c.nombre, codigo: Object.keys(this.form.controls[c.nombre].errors ?? {})[0] });
      document.getElementById(invalidos[0].id)?.focus();
      return;
    }

    this.enviando.set(true);
    const { nombres, apellidos, email, contrasena } = this.form.getRawValue();
    this.session.registrar({ nombres, apellidos, email, contrasena }).subscribe({
      next: (r) => {
        this.enviando.set(false);
        if (r === 'correo_existente') {
          this.logger.track('auth_result', { accion: 'registro', resultado: 'correo_existente', origen: this.origen() });
          this.logger.track('form_error', { campo: 'email', codigo: 'existe' });
          this.form.controls.email.setErrors({ existe: true });
          this.form.controls.email.markAsTouched();
          document.getElementById('registro-email')?.focus();
          return;
        }
        this.logger.track('auth_result', { accion: 'registro', resultado: 'ok', origen: this.origen() });
        this.toast.show('auth.welcome', 'exito', [], { nombres: r.nombres });
        this.router.navigateByUrl(this.historial.destino(this.volver()));
      },
      error: () => this.enviando.set(false),
    });
  }
}
