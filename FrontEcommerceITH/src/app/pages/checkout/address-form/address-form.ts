import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { departamentos, distritos, provincias, Ubigeo } from '../../../core/checkout/ubigeo.logic';
import { cambiosDe, codigoDeError } from '../../../core/validation/form-state';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';

/**
 * Dirección nueva (spec 006, CA-2.2, 2.5, 2.6). Departamento → provincia → distrito son selectores dependientes: cada uno se habilita al
 * elegir el anterior, solo muestra opciones válidas (H5) y se reinicia si cambia el anterior. Atributos `autocomplete` estándar (H7).
 * El `FormGroup` es de la página: `departamento`, `provincia`, `ubigeo_id`, `direccion`, `referencia`, `destinatario`, `telefono`, `guardar`.
 */
@Component({
  selector: 'app-address-form',
  imports: [ReactiveFormsModule, TranslocoPipe, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="formulario-checkout" [formGroup]="form()" class="grid gap-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label for="envio-departamento" class="mb-1 block text-sm font-semibold">{{ 'ubigeo.department' | transloco }}</label>
          <select id="envio-departamento" formControlName="departamento" autocomplete="address-level1" [class]="clase('departamento')" [attr.aria-describedby]="err('departamento') ? 'envio-departamento-error' : null" (change)="alCambiarDepartamento()">
            <option value="">{{ 'ubigeo.choose' | transloco }}</option>
            @for (d of deps(); track d) { <option [value]="d">{{ d }}</option> }
          </select>
          <app-field-error errorId="envio-departamento-error" [codigo]="err('departamento')" />
        </div>
        <div>
          <label for="envio-provincia" class="mb-1 block text-sm font-semibold">{{ 'ubigeo.province' | transloco }}</label>
          <select id="envio-provincia" formControlName="provincia" autocomplete="address-level2" [class]="clase('provincia')" [attr.disabled]="provs().length ? null : ''" [attr.aria-describedby]="err('provincia') ? 'envio-provincia-error' : null" (change)="alCambiarProvincia()">
            <option value="">{{ (provs().length ? 'ubigeo.choose' : 'ubigeo.chooseDepartmentFirst') | transloco }}</option>
            @for (p of provs(); track p) { <option [value]="p">{{ p }}</option> }
          </select>
          <app-field-error errorId="envio-provincia-error" [codigo]="err('provincia')" />
        </div>
        <div>
          <label for="envio-distrito" class="mb-1 block text-sm font-semibold">{{ 'ubigeo.district' | transloco }}</label>
          <select id="envio-distrito" formControlName="ubigeo_id" [class]="clase('ubigeo_id')" [attr.disabled]="dists().length ? null : ''" [attr.aria-describedby]="err('ubigeo_id') ? 'envio-distrito-error' : null">
            <option value="">{{ (dists().length ? 'ubigeo.choose' : 'ubigeo.chooseProvinceFirst') | transloco }}</option>
            @for (d of dists(); track d.id) { <option [value]="d.id">{{ d.distrito }}</option> }
          </select>
          <app-field-error errorId="envio-distrito-error" [codigo]="err('ubigeo_id')" />
        </div>
      </div>

      <div>
        <label for="envio-direccion" class="mb-1 block text-sm font-semibold">{{ 'checkout.address' | transloco }}</label>
        <input id="envio-direccion" type="text" formControlName="direccion" autocomplete="street-address" [class]="clase('direccion')" [attr.aria-describedby]="err('direccion') ? 'envio-direccion-error' : null" />
        <app-field-error errorId="envio-direccion-error" [codigo]="err('direccion')" />
      </div>

      <div>
        <label for="envio-referencia" class="mb-1 block text-sm font-semibold">{{ 'checkout.reference' | transloco }} <span class="font-normal text-muted">({{ 'checkout.optional' | transloco }})</span></label>
        <input id="envio-referencia" type="text" formControlName="referencia" [class]="campo" />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="envio-destinatario" class="mb-1 block text-sm font-semibold">{{ 'checkout.recipient' | transloco }}</label>
          <input id="envio-destinatario" type="text" formControlName="destinatario" autocomplete="name" [class]="clase('destinatario')" [attr.aria-describedby]="err('destinatario') ? 'envio-destinatario-error' : null" />
          <app-field-error errorId="envio-destinatario-error" [codigo]="err('destinatario')" />
        </div>
        <div>
          <label for="envio-telefono" class="mb-1 block text-sm font-semibold">{{ 'checkout.phone' | transloco }}</label>
          <input id="envio-telefono" type="tel" inputmode="numeric" maxlength="9" formControlName="telefono" autocomplete="tel" [class]="clase('telefono')" [attr.aria-describedby]="err('telefono') ? 'envio-telefono-error' : null" />
          <app-field-error errorId="envio-telefono-error" [codigo]="err('telefono')" />
        </div>
      </div>

      <label class="flex min-h-11 items-center gap-2 text-sm">
        <input id="envio-guardar" type="checkbox" formControlName="guardar" class="size-5 accent-primary" />
        {{ 'checkout.saveAddress' | transloco }}
      </label>
    </div>
  `,
})
export class AddressForm {
  readonly form = input.required<FormGroup>();
  readonly ubigeos = input.required<Ubigeo[]>();
  /** Se intentó continuar: los errores se muestran aunque el campo no se haya tocado (CA-2.4). */
  readonly intentado = input(false);

  protected readonly campo = CAMPO;
  private readonly version = cambiosDe(this.form);

  protected readonly deps = computed(() => departamentos(this.ubigeos()));
  protected readonly provs = computed(() => (this.version(), provincias(this.ubigeos(), this.form().value.departamento ?? '')));
  protected readonly dists = computed(() => (this.version(), distritos(this.ubigeos(), this.form().value.departamento ?? '', this.form().value.provincia ?? '')));

  protected err(nombre: string): string | null {
    this.version();
    return codigoDeError(this.form().controls[nombre], this.intentado());
  }

  protected clase(nombre: string): string {
    return this.err(nombre) ? CAMPO_ERROR : CAMPO;
  }

  protected alCambiarDepartamento(): void {
    this.form().patchValue({ provincia: '', ubigeo_id: '' });
  }

  protected alCambiarProvincia(): void {
    this.form().patchValue({ ubigeo_id: '' });
  }
}
