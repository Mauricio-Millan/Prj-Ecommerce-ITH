import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { InteractionLogger } from '../../../core/telemetry/interaction-logger';
import { cambios, codigoDeError } from '../../../core/validation/form-state';
import { correo } from '../../../core/validation/validators';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';

/**
 * Recuperar la contraseña (spec 004, HU-3). Con un correo válido SIEMPRE se muestra el mismo mensaje, exista o no la cuenta (no revela
 * qué correos tienen cuenta). En la Fase 1 no se envía ningún correo.
 */
@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl font-bold">{{ 'auth.recover.title' | transloco }}</h1>

    @if (enviado()) {
      <p role="status" class="mt-4 rounded-control bg-surface-muted p-3 text-sm">{{ 'auth.recover.sent' | transloco }}</p>
      <a routerLink="/auth/login" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.ir-login" class="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{{ 'auth.recover.backToLogin' | transloco }}</a>
    } @else {
      <form data-zone="formulario-cuenta" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="mt-4 grid gap-4">
        <p class="text-sm text-muted">{{ 'auth.recover.help' | transloco }}</p>
        <div>
          <label for="recuperar-email" class="mb-1 block text-sm font-semibold">{{ 'auth.email' | transloco }}</label>
          <input id="recuperar-email" type="email" formControlName="email" autocomplete="email" inputmode="email" [class]="errEmail() ? campoError : campo" [attr.aria-invalid]="errEmail() ? 'true' : null" [attr.aria-describedby]="errEmail() ? 'recuperar-email-error' : null" />
          <app-field-error errorId="recuperar-email-error" [codigo]="errEmail()" />
        </div>
        <button type="submit" data-zone="cta-principal" data-track="cuenta.recuperar" class="min-h-12 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'auth.recover.submit' | transloco }}</button>
      </form>
      <a routerLink="/auth/login" [queryParams]="{ volver: volver() }" [state]="estado()" data-track="cuenta.ir-login" class="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{{ 'auth.recover.backToLogin' | transloco }}</a>
    }
  `,
})
export default class Recuperar {
  private readonly route = inject(ActivatedRoute);
  private readonly logger = inject(InteractionLogger);

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;

  protected readonly form = inject(NonNullableFormBuilder).group({ email: [(history.state?.email as string | undefined) ?? '', [Validators.required, correo]] });
  private readonly version = cambios(this.form);
  private readonly intentado = signal(false);
  protected readonly enviado = signal(false);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly volver = computed(() => this.query().get('volver'));
  protected readonly estado = computed(() => (this.version(), { email: this.form.controls.email.value, origen: history.state?.origen }));
  protected readonly errEmail = computed(() => (this.version(), codigoDeError(this.form.controls.email, this.intentado())));

  constructor() {
    tituloDePagina('auth.recover.title');
  }

  protected enviar(): void {
    this.intentado.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.logger.track('form_error', { campo: 'email', codigo: Object.keys(this.form.controls.email.errors ?? {})[0] });
      document.getElementById('recuperar-email')?.focus();
      return;
    }
    this.logger.track('auth_result', { accion: 'recuperar', resultado: 'ok', origen: history.state?.origen === 'encabezado' ? 'encabezado' : (this.volver() ?? '').startsWith('/checkout') ? 'checkout' : 'otro' });
    this.enviado.set(true);
  }
}
