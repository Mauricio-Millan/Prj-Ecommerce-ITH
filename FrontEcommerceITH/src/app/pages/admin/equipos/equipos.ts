import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { compactar } from '../../../core/search/normalize';
import { AdminField, describedBy } from '../../../shared/ui/admin-field/admin-field';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { ToastService } from '../../../shared/ui/toast/toast';

/** Marcas y equipos del panel (spec 009, HU-4): crear marcas, crear y editar equipos. No hay borrar. */
@Component({
  selector: 'app-equipos-admin',
  imports: [TranslocoPipe, AdminField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-equipos" class="mx-auto grid max-w-3xl gap-8">
      <h1 class="text-2xl font-bold">{{ 'adminEquip.title' | transloco }}</h1>

      <section class="grid gap-3" aria-labelledby="eq-marcas">
        <h2 id="eq-marcas" class="text-lg font-semibold">{{ 'adminEquip.brands' | transloco }}</h2>
        <ul class="flex flex-wrap gap-2">
          @for (m of datos().marcas; track m.id) {
            <li class="rounded-control border border-border px-3 py-2 text-sm">{{ m.nombre }}</li>
          }
        </ul>
        <form class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end" novalidate (submit)="crearMarca($event)">
          <app-admin-field campoId="eq-marca-nombre" etiqueta="adminEquip.newBrand" [error]="errorMarca()">
            <input id="eq-marca-nombre" type="text" [class]="errorMarca() ? campoError : campo" [value]="nombreMarca()" [attr.aria-invalid]="!!errorMarca()" [attr.aria-describedby]="dMarca()" (input)="nombreMarca.set($any($event.target).value)" />
          </app-admin-field>
          <button type="submit" data-track="admin.marca-crear" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'adminEquip.addBrand' | transloco }}</button>
        </form>
      </section>

      <section class="grid gap-3" aria-labelledby="eq-equipos">
        <h2 id="eq-equipos" class="text-lg font-semibold">{{ 'adminEquip.devices' | transloco }}</h2>
        <form class="grid gap-3 rounded-card border border-border p-4 sm:grid-cols-3" novalidate (submit)="guardarEquipo($event)">
          <p class="font-semibold sm:col-span-3">{{ (editando() ? 'adminEquip.editDevice' : 'adminEquip.newDevice') | transloco }}</p>
          <app-admin-field campoId="eq-marca" etiqueta="adminEquip.brand" [error]="errores()['marca'] || null" [requerido]="true">
            <select id="eq-marca" [class]="errores()['marca'] ? campoError : campo" [attr.aria-invalid]="!!errores()['marca']" [attr.aria-describedby]="d('eq-marca', 'marca', false)" (change)="marcaId.set(+$any($event.target).value || null)">
              <option value="">{{ 'adminProduct.form.choose' | transloco }}</option>
              @for (m of datos().marcas; track m.id) {
                <option [value]="m.id" [selected]="marcaId() === m.id">{{ m.nombre }}</option>
              }
            </select>
          </app-admin-field>
          <app-admin-field campoId="eq-modelo" etiqueta="adminEquip.model" [error]="errores()['modelo'] || null" [requerido]="true">
            <input id="eq-modelo" type="text" [class]="errores()['modelo'] ? campoError : campo" [value]="modelo()" [attr.aria-invalid]="!!errores()['modelo']" [attr.aria-describedby]="d('eq-modelo', 'modelo', false)" (input)="modelo.set($any($event.target).value)" />
          </app-admin-field>
          <app-admin-field campoId="eq-codigo" etiqueta="adminEquip.code" ayuda="adminEquip.codeHelp">
            <input id="eq-codigo" type="text" [class]="campo" [value]="codigo()" aria-describedby="eq-codigo-ayuda" (input)="codigo.set($any($event.target).value)" />
          </app-admin-field>
          <div class="flex flex-wrap gap-2 sm:col-span-3">
            <button type="submit" data-track="admin.equipo-guardar" class="min-h-11 rounded-control bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'adminEquip.save' | transloco }}</button>
            @if (editando()) {
              <button type="button" class="min-h-11 rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted" (click)="limpiar()">{{ 'adminProduct.form.cancel' | transloco }}</button>
            }
          </div>
        </form>

        <p role="status" class="text-sm text-muted">{{ 'adminEquip.count' | transloco: { n: filas().length } }}</p>
        <ul class="grid gap-2">
          @for (f of filas(); track f.equipo.id) {
            <li class="flex flex-wrap items-center gap-3 rounded-card border border-border p-3">
              <div class="min-w-0 flex-1 basis-48">
                <p class="text-sm font-semibold">{{ f.marca }} {{ f.equipo.modelo }}</p>
                <p class="text-xs text-muted">{{ f.equipo.codigo_modelo ?? ('adminEquip.noCode' | transloco) }} · {{ 'adminEquip.products' | transloco: { n: f.productos } }}</p>
              </div>
              <button type="button" data-track="admin.equipo-editar" class="min-h-11 rounded-control border border-border-control px-3 text-sm font-semibold hover:bg-surface-muted" (click)="editar(f.equipo.id)">{{ 'adminProduct.list.edit' | transloco }}</button>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export default class EquiposAdmin {
  private readonly catalogo = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  protected readonly campo = CAMPO;
  protected readonly campoError = CAMPO_ERROR;
  private readonly version = signal(0);
  protected readonly datos = computed(() => {
    this.version();
    return this.catalogo.adminDatos();
  });

  protected readonly nombreMarca = signal('');
  protected readonly errorMarca = signal<string | null>(null);
  protected readonly dMarca = computed(() => describedBy('eq-marca-nombre', false, this.errorMarca()));

  protected readonly editando = signal<number | null>(null);
  protected readonly marcaId = signal<number | null>(null);
  protected readonly modelo = signal('');
  protected readonly codigo = signal('');
  protected readonly errores = signal<Record<string, string>>({});

  protected readonly filas = computed(() => {
    const { equipos, marcas, vinculos } = this.datos();
    return equipos
      .map((equipo) => ({ equipo, marca: marcas.find((m) => m.id === equipo.marca_id)?.nombre ?? '', productos: vinculos.filter((v) => v.equipo_id === equipo.id).length }))
      .sort((a, b) => a.marca.localeCompare(b.marca) || a.equipo.modelo.localeCompare(b.equipo.modelo));
  });

  constructor() {
    tituloDePagina('adminEquip.title');
  }

  protected d = (id: string, clave: string, ayuda: boolean): string | null => describedBy(id, ayuda, this.errores()[clave] ?? null);

  protected crearMarca(ev: Event): void {
    ev.preventDefault();
    const nombre = this.nombreMarca().trim();
    if (nombre.length < 2) return this.errorMarca.set('marca-corta');
    if (this.datos().marcas.some((m) => compactar(m.nombre) === compactar(nombre))) return this.errorMarca.set('marca-duplicada');
    this.catalogo.guardarMarca(nombre);
    this.errorMarca.set(null);
    this.nombreMarca.set('');
    this.version.update((v) => v + 1);
    this.toast.show('adminEquip.brandSaved', 'exito', [], { nombre });
  }

  protected editar(id: number): void {
    const e = this.datos().equipos.find((x) => x.id === id);
    if (!e) return;
    this.editando.set(id);
    this.marcaId.set(e.marca_id);
    this.modelo.set(e.modelo);
    this.codigo.set(e.codigo_modelo ?? '');
    this.errores.set({});
    document.getElementById('eq-marca')?.focus();
  }

  protected limpiar(): void {
    this.editando.set(null);
    this.marcaId.set(null);
    this.modelo.set('');
    this.codigo.set('');
    this.errores.set({});
  }

  protected guardarEquipo(ev: Event): void {
    ev.preventDefault();
    const errores: Record<string, string> = {};
    if (this.marcaId() === null) errores['marca'] = 'marca';
    if (!this.modelo().trim()) errores['modelo'] = 'requerido';
    else if (this.datos().equipos.some((q) => q.id !== this.editando() && q.marca_id === this.marcaId() && compactar(q.modelo) === compactar(this.modelo()))) errores['modelo'] = 'equipo-duplicado';
    this.errores.set(errores);
    if (Object.keys(errores).length) return;
    const e = this.catalogo.guardarEquipo({ id: this.editando() ?? undefined, marca_id: this.marcaId()!, modelo: this.modelo(), codigo_modelo: this.codigo() });
    this.toast.show('adminEquip.deviceSaved', 'exito', [], { nombre: e.modelo });
    this.limpiar();
    this.version.update((v) => v + 1);
  }
}
