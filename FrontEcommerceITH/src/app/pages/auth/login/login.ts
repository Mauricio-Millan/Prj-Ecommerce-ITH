import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SessionApi } from '../../../core/auth/session.api';
import { NavigationHistory } from '../../../core/auth/volver';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { cambios, codigoDeError } from '../../../core/validation/form-state';
import { correo } from '../../../core/validation/validators';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { PasswordField } from '../../../shared/ui/password-field/password-field';
import { ToastService } from '../../../shared/ui/toast/toast';

/**
 * Iniciar sesión (spec 004, HU-1). Vuelve a donde el usuario estaba (`volver`) y conserva el carrito.
 * Si las credenciales fallan, el mensaje es el mismo sin importar qué falló (no revela qué correos tienen cuenta, CA-1.5):
 * se compensa con acciones concretas (crear cuenta, recuperar contraseña).
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, PasswordField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-bold">{{ 'auth.login.title' | transloco }}</h1>

    @if (desdeCheckout()) {
      <p class="mt-3 rounded-control bg-surface-muted p-3 text-sm">{{ 'auth.checkoutContext' | transloco }}</p>
    }

    @if (credencialesMal()) {
      <div role="alert" class="mt-3 rounded-control border border-danger bg-surface-muted p-3 text-sm">
        <p class="font-semibold text-danger">{{ 'auth.badCredentials' | transloco }}</p>
        <p class="mt-1 flex flex-wrap gap-x-4">
          <a routerLink="/auth/registro" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.ir-registro" class="inline-flex min-h-11 items-center font-semibold text-primary underline">{{ 'auth.createAccount' | transloco }}</a>
          <a routerLink="/auth/recuperar" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.olvide" class="inline-flex min-h-11 items-center font-semibold text-primary underline">{{ 'auth.forgot' | transloco }}</a>
        </p>
      </div>
    }

    <form data-zone="formulario-cuenta" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="mt-4 grid gap-4">
      <div>
        <label for="login-email" class="mb-1 block text-sm font-semibold">{{ 'auth.email' | transloco }}</label>
        <input
          id="login-email"
          type="email"
          formControlName="email"
          autocomplete="email"
          inputmode="email"
          [class]="errEmail() ? campoError : campo"
          [attr.aria-invalid]="errEmail() ? 'true' : null"
          [attr.aria-describedby]="errEmail() ? 'login-email-error' : null"
        />
        <app-field-error errorId="login-email-error" [codigo]="errEmail()" />
      </div>

      <div>
        <label for="login-contrasena" class="mb-1 block text-sm font-semibold">{{ 'auth.password' | transloco }}</label>
        <app-password-field
          inputId="login-contrasena"
          formControlName="contrasena"
          autocomplete="current-password"
          [conError]="!!errContrasena()"
          [describedBy]="errContrasena() ? 'login-contrasena-error' : ''"
        />
        <app-field-error errorId="login-contrasena-error" [codigo]="errContrasena()" />
      </div>

      <button
        type="submit"
        data-zone="cta-principal"
        data-track="cuenta.login"
        class="min-h-12 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        [disabled]="enviando()"
      >{{ (enviando() ? 'auth.login.submitting' : 'auth.login.submit') | transloco }}</button>
    </form>

    <p class="mt-4 grid gap-1 text-sm">
      <span>
        {{ 'auth.noAccount' | transloco }}
        <a routerLink="/auth/registro" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.ir-registro" class="inline-flex min-h-11 items-center font-semibold text-primary underline">{{ 'auth.createLink' | transloco }}</a>
      </span>
      <a routerLink="/auth/recuperar" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.olvide" class="inline-flex min-h-11 items-center font-semibold text-primary underline">{{ 'auth.forgot' | transloco }}</a>
    </p>
  `,
})
export default class Login {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionApi);
  private readonly historial = inject(NavigationHistory);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(InteractionLogger);
  private readonly campoContrasena = viewChild.required(PasswordField);

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [(history.state?.email as string | undefined) ?? '', [Validators.required, correo]],
    contrasena: ['', Validators.required],
  });
  private readonly version = cambios(this.form);
  private readonly intentado = signal(false);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly volver = computed(() => this.query().get('volver'));
  protected readonly enviando = signal(false);
  protected readonly credencialesMal = signal(false);

  protected readonly desdeCheckout = computed(() => (this.volver() ?? '').startsWith('/checkout'));
  /** `checkout` si venía del pago, `encabezado` si tocó el ícono de cuenta, si no `otro` (CA-5.2). */
  private readonly origen = computed<'checkout' | 'encabezado' | 'otro'>(() =>
    this.desdeCheckout() ? 'checkout' : history.state?.origen === 'encabezado' ? 'encabezado' : 'otro',
  );
  /** Lo que viaja a la otra pantalla de cuenta: el correo escrito y de dónde vino. Solo en el estado de la navegación, nunca en la URL. */
  protected readonly estado = computed(() => {
    this.version();
    return { email: this.form.controls.email.value, origen: this.origen() };
  });

  protected readonly errEmail = computed(() => (this.version(), codigoDeError(this.form.controls.email, this.intentado())));
  protected readonly errContrasena = computed(() => (this.version(), codigoDeError(this.form.controls.contrasena, this.intentado())));

  constructor() {
    tituloDePagina('auth.login.title');
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.intentado.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      for (const [campo, c] of Object.entries(this.form.controls)) {
        const codigo = Object.keys(c.errors ?? {})[0];
        if (codigo) this.logger.track('form_error', { campo, codigo });
      }
      (document.getElementById(this.form.controls.email.invalid ? 'login-email' : 'login-contrasena') as HTMLElement | null)?.focus();
      return;
    }

    this.enviando.set(true);
    this.credencialesMal.set(false);
    const { email, contrasena } = this.form.getRawValue();
    this.session.iniciarSesion(email, contrasena).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        if (!usuario) {
          // El correo se conserva; la contraseña se borra y el foco vuelve a ella (CA-1.5, H3).
          this.logger.track('auth_result', { accion: 'login', resultado: 'credenciales', origen: this.origen() });
          this.credencialesMal.set(true);
          this.form.controls.contrasena.reset('');
          this.intentado.set(false);
          this.campoContrasena().enfocar();
          return;
        }
        this.logger.track('auth_result', { accion: 'login', resultado: 'ok', origen: this.origen() });
        this.toast.show('auth.hello', 'exito', [], { nombres: usuario.nombres });
        this.router.navigateByUrl(this.historial.destino(this.volver()));
      },
      error: () => this.enviando.set(false),
    });
  }
}
