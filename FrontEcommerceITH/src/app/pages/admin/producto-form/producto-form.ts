import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  BorradorProducto, ErroresProducto, aBorrador, aProducto, atributosDe, borradorVacio, especificacionesQueSePierden, validarProducto,
} from '../../../core/admin/producto.logic';
import { CatalogApi } from '../../../core/catalog/catalog.api';
import { Condicion } from '../../../core/catalog/catalog.models';
import { tituloDePagina } from '../../../core/i18n/page-title';
import { DetectorLector } from '../../../core/scan/lector-usb';
import { AdminField, describedBy } from '../../../shared/ui/admin-field/admin-field';
import { CAMPO, CAMPO_ERROR } from '../../../shared/ui/form-classes';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';

/** Categorías raíz cuyos productos se asocian a equipos (nivel 3 de compatibilidad, modelo de datos § 3). */
const RAICES_DE_LAPTOP = ['componentes-laptop', 'repuestos-laptop'];
const CONDICIONES: Condicion[] = ['nuevo', 'original', 'compatible'];

/**
 * Alta y edición de un producto (spec 009, HU-2 y HU-3). Se edita un borrador; NADA se guarda hasta que `validarProducto` no da errores (H5).
 * El SKU queda bloqueado al editar. Un producto no se elimina: se oculta.
 */
@Component({
  selector: 'app-producto-form',
  imports: [RouterLink, TranslocoPipe, AdminField, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-zone="admin-producto" class="mx-auto grid max-w-3xl gap-4">
      @if (noExiste()) {
        <h1 class="text-2xl font-bold">{{ 'adminProduct.notFound' | transloco }}</h1>
        <a routerLink="/admin/productos" class="text-primary underline">{{ 'adminProduct.back' | transloco }}</a>
      } @else {
        <a routerLink="/admin/productos" class="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"><app-icon name="volver" [size]="16" /> {{ 'adminProduct.back' | transloco }}</a>
        <h1 class="text-2xl font-bold">{{ (esNuevo ? 'adminProduct.form.titleNew' : 'adminProduct.form.titleEdit') | transloco }}</h1>

        @if (resumen().length) {
          <div id="pf-resumen" tabindex="-1" role="alert" class="rounded-card border border-danger p-3">
            <p class="flex items-center gap-2 font-semibold text-danger"><app-icon name="advertencia" [size]="18" /> {{ 'adminProduct.form.summary' | transloco: { n: resumen().length } }}</p>
            <ul class="mt-2 list-disc pl-5 text-sm">
              @for (r of resumen(); track r.clave) {
                <li><a [href]="'#' + id(r.clave)" class="underline" (click)="ir($event, r.clave)">{{ r.etiqueta | transloco }}</a>: {{ 'adminProduct.error.' + r.codigo | transloco }}</li>
              }
            </ul>
          </div>
        }

        <form class="grid gap-6" novalidate (submit)="guardar($event)">
          <!-- Datos básicos -->
          <fieldset class="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2">
            <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.basic' | transloco }}</legend>
            <app-admin-field class="sm:col-span-2" [campoId]="id('nombre')" etiqueta="adminProduct.field.nombre" [error]="e('nombre')" [requerido]="true">
              <input [id]="id('nombre')" type="text" [class]="cls('nombre')" [value]="b().nombre" [attr.aria-invalid]="!!e('nombre')" [attr.aria-describedby]="d('nombre', false)" (input)="set('nombre', $any($event.target).value)" />
            </app-admin-field>
            <app-admin-field [campoId]="id('sku')" etiqueta="adminProduct.field.sku" [ayuda]="esNuevo ? 'adminProduct.hint.sku' : 'adminProduct.hint.skuLocked'" [error]="e('sku')" [requerido]="true">
              <input [id]="id('sku')" type="text" autocapitalize="characters" [class]="cls('sku')" [value]="b().sku" [readOnly]="!esNuevo" [attr.aria-invalid]="!!e('sku')" [attr.aria-describedby]="d('sku', true)" (input)="set('sku', $any($event.target).value.toUpperCase())" />
            </app-admin-field>
            <app-admin-field [campoId]="id('categoria')" etiqueta="adminProduct.field.categoria" [error]="e('categoria')" [requerido]="true">
              <select [id]="id('categoria')" [class]="cls('categoria')" [attr.aria-invalid]="!!e('categoria')" [attr.aria-describedby]="d('categoria', false)" (change)="cambiarCategoria(+$any($event.target).value || null, $event)">
                <option value="">{{ 'adminProduct.form.choose' | transloco }}</option>
                @for (g of grupos(); track g.raiz.id) {
                  <optgroup [label]="g.raiz.clave_i18n | transloco">
                    @for (h of g.hijas; track h.id) {
                      <option [value]="h.id" [selected]="b().categoria_id === h.id">{{ h.clave_i18n | transloco }}</option>
                    }
                  </optgroup>
                }
              </select>
            </app-admin-field>
            <app-admin-field [campoId]="id('marca')" etiqueta="adminProduct.field.marca" [error]="e('marca')" [requerido]="true">
              <select [id]="id('marca')" [class]="cls('marca')" [attr.aria-invalid]="!!e('marca')" [attr.aria-describedby]="d('marca', false)" (change)="set('marca_id', +$any($event.target).value || null)">
                <option value="">{{ 'adminProduct.form.choose' | transloco }}</option>
                @for (m of datos.marcas; track m.id) {
                  <option [value]="m.id" [selected]="b().marca_id === m.id">{{ m.nombre }}</option>
                }
              </select>
            </app-admin-field>
            <app-admin-field [campoId]="id('modelo')" etiqueta="adminProduct.field.modelo" [error]="e('modelo')" [requerido]="true">
              <input [id]="id('modelo')" type="text" [class]="cls('modelo')" [value]="b().modelo" [attr.aria-invalid]="!!e('modelo')" [attr.aria-describedby]="d('modelo', false)" (input)="set('modelo', $any($event.target).value)" />
            </app-admin-field>
            <app-admin-field [campoId]="id('numero_parte')" etiqueta="adminProduct.field.numero_parte" ayuda="adminProduct.hint.numero_parte">
              <input [id]="id('numero_parte')" type="text" [class]="cls('numero_parte')" [value]="b().numero_parte" [attr.aria-describedby]="d('numero_parte', true)" (input)="set('numero_parte', $any($event.target).value)" />
            </app-admin-field>
            <app-admin-field [campoId]="id('codigo_barras')" etiqueta="adminProduct.field.codigo_barras" ayuda="adminProduct.hint.codigo_barras" [error]="e('codigo_barras')">
              <input [id]="id('codigo_barras')" type="text" inputmode="numeric" [class]="cls('codigo_barras')" [value]="b().codigo_barras" [attr.aria-invalid]="!!e('codigo_barras')" [attr.aria-describedby]="d('codigo_barras', true)" (input)="set('codigo_barras', $any($event.target).value)" (keydown)="alTeclearCodigo($event)" />
            </app-admin-field>
            <app-admin-field [campoId]="id('condicion')" etiqueta="adminProduct.field.condicion">
              <select [id]="id('condicion')" [class]="cls('condicion')" (change)="set('condicion', $any($event.target).value)">
                @for (c of condiciones; track c) {
                  <option [value]="c" [selected]="b().condicion === c">{{ 'adminProduct.condition.' + c | transloco }}</option>
                }
              </select>
            </app-admin-field>
            <app-admin-field [campoId]="id('garantia')" etiqueta="adminProduct.field.garantia" ayuda="adminProduct.hint.garantia" [error]="e('garantia')" [requerido]="true">
              <input [id]="id('garantia')" type="text" inputmode="numeric" [class]="cls('garantia')" [value]="b().garantia_meses" [attr.aria-invalid]="!!e('garantia')" [attr.aria-describedby]="d('garantia', true)" (input)="set('garantia_meses', $any($event.target).value)" />
            </app-admin-field>
          </fieldset>

          <!-- Descripción -->
          <fieldset class="grid gap-4 rounded-card border border-border p-4">
            <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.description' | transloco }}</legend>
            <app-admin-field [campoId]="id('descripcion')" etiqueta="adminProduct.field.descripcion" ayuda="adminProduct.hint.descripcion" [error]="e('descripcion')" [requerido]="true">
              <textarea [id]="id('descripcion')" rows="5" [class]="cls('descripcion')" [value]="b().descripcion" [attr.aria-invalid]="!!e('descripcion')" [attr.aria-describedby]="d('descripcion', true)" (input)="set('descripcion', $any($event.target).value)"></textarea>
            </app-admin-field>
          </fieldset>

          <!-- Precio y stock -->
          <fieldset class="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2">
            <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.price' | transloco }}</legend>
            <app-admin-field [campoId]="id('precio')" etiqueta="adminProduct.field.precio" ayuda="adminProduct.hint.precio" [error]="e('precio')" [requerido]="true">
              <input [id]="id('precio')" type="text" inputmode="decimal" [class]="cls('precio')" [value]="b().precio_usd" [attr.aria-invalid]="!!e('precio')" [attr.aria-describedby]="d('precio', true)" (input)="set('precio_usd', $any($event.target).value)" />
            </app-admin-field>
            <app-admin-field [campoId]="id('stock')" etiqueta="adminProduct.field.stock" ayuda="adminProduct.hint.stock" [error]="e('stock')" [requerido]="true">
              <input [id]="id('stock')" type="text" inputmode="numeric" [class]="cls('stock')" [value]="b().stock" [attr.aria-invalid]="!!e('stock')" [attr.aria-describedby]="d('stock', true)" (input)="set('stock', $any($event.target).value)" />
            </app-admin-field>
            <label class="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" class="size-5" [checked]="b().destacado" (change)="set('destacado', $any($event.target).checked)" /> {{ 'adminProduct.field.destacado' | transloco }}
            </label>
          </fieldset>

          <!-- Imágenes -->
          <fieldset class="grid gap-4 rounded-card border border-border p-4">
            <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.images' | transloco }}</legend>
            <p id="pf-imagenes-ayuda" class="text-sm text-muted">{{ 'adminProduct.hint.imagenes' | transloco }}</p>
            @if (e('imagenes'); as ei) {
              <p id="pf-imagenes" tabindex="-1" class="flex items-center gap-1.5 text-sm font-medium text-danger"><app-icon name="advertencia" [size]="16" /> {{ 'adminProduct.error.' + ei | transloco }}</p>
            }
            <ol class="grid gap-3">
              @for (img of b().imagenes; track $index; let i = $index) {
                <li class="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-[5rem_1fr]">
                  <img [src]="img.url" [alt]="img.alt" width="80" height="80" class="size-20 rounded-control bg-surface-muted object-cover" (error)="$any($event.target).style.visibility = 'hidden'" (load)="$any($event.target).style.visibility = 'visible'" />
                  <div class="grid gap-3">
                    <p class="text-sm font-semibold">{{ (i === 0 ? 'adminProduct.form.imageMain' : 'adminProduct.form.imageN') | transloco: { n: i + 1 } }}</p>
                    <app-admin-field [campoId]="id('img.' + i + '.url')" etiqueta="adminProduct.field.imagenUrl" [error]="e('img.' + i + '.url')" [requerido]="true">
                      <input [id]="id('img.' + i + '.url')" type="text" [class]="cls('img.' + i + '.url')" [value]="img.url" [attr.aria-invalid]="!!e('img.' + i + '.url')" [attr.aria-describedby]="d('img.' + i + '.url', false)" (input)="setImagen(i, 'url', $any($event.target).value)" />
                    </app-admin-field>
                    <app-admin-field [campoId]="id('img.' + i + '.alt')" etiqueta="adminProduct.field.imagenAlt" ayuda="adminProduct.hint.imagenAlt" [error]="e('img.' + i + '.alt')" [requerido]="true">
                      <input [id]="id('img.' + i + '.alt')" type="text" [class]="cls('img.' + i + '.alt')" [value]="img.alt" [attr.aria-invalid]="!!e('img.' + i + '.alt')" [attr.aria-describedby]="d('img.' + i + '.alt', true)" (input)="setImagen(i, 'alt', $any($event.target).value)" />
                    </app-admin-field>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="min-h-11 rounded-control border border-border-control px-3 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="i === 0" (click)="moverImagen(i, -1)">{{ 'adminProduct.form.up' | transloco }}</button>
                      <button type="button" class="min-h-11 rounded-control border border-border-control px-3 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50" [disabled]="i === b().imagenes.length - 1" (click)="moverImagen(i, 1)">{{ 'adminProduct.form.down' | transloco }}</button>
                      <button type="button" class="min-h-11 rounded-control border border-border-control px-3 text-sm font-semibold hover:bg-surface-muted" (click)="quitarImagen(i)">{{ 'adminProduct.form.remove' | transloco }}</button>
                    </div>
                  </div>
                </li>
              }
            </ol>
            <button type="button" data-track="admin.imagen-agregar" class="min-h-11 justify-self-start rounded-control border border-border-control px-4 text-sm font-semibold hover:bg-surface-muted" (click)="agregarImagen()">{{ 'adminProduct.form.addImage' | transloco }}</button>
          </fieldset>

          <!-- Especificaciones -->
          <fieldset class="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2">
            <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.specs' | transloco }}</legend>
            @if (!atributos().length) {
              <p class="text-sm text-muted sm:col-span-2">{{ 'adminProduct.form.noSpecs' | transloco }}</p>
            }
            @for (a of atributos(); track a.id) {
              @let cid = id('esp.' + a.clave);
              @if (a.tipo === 'booleano') {
                <label class="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" class="size-5" [id]="cid" [checked]="b().especificaciones[a.clave] === true" (change)="setEsp(a.clave, $any($event.target).checked)" /> {{ a.clave_i18n | transloco }}
                </label>
              } @else {
                <app-admin-field [campoId]="cid" [etiqueta]="a.clave_i18n" [error]="e('esp.' + a.clave)" [requerido]="a.usa_compatibilidad" [ayuda]="a.usa_compatibilidad ? 'adminProduct.hint.compatAttr' : null">
                  @if (a.tipo === 'lista') {
                    <select [id]="cid" [class]="cls('esp.' + a.clave)" [attr.aria-invalid]="!!e('esp.' + a.clave)" [attr.aria-describedby]="d('esp.' + a.clave, a.usa_compatibilidad)" (change)="setEsp(a.clave, $any($event.target).value)">
                      <option value="">{{ 'adminProduct.form.choose' | transloco }}</option>
                      @for (v of a.valores_permitidos ?? []; track v) {
                        <option [value]="v" [selected]="b().especificaciones[a.clave] === v">{{ v }}</option>
                      }
                    </select>
                  } @else {
                    <div class="flex items-center gap-2">
                      <input [id]="cid" [type]="'text'" [attr.inputmode]="a.tipo === 'numero' ? 'decimal' : null" [class]="cls('esp.' + a.clave)" [value]="$any(b().especificaciones)[a.clave] ?? ''" [attr.aria-invalid]="!!e('esp.' + a.clave)" [attr.aria-describedby]="d('esp.' + a.clave, a.usa_compatibilidad)" (input)="setEsp(a.clave, $any($event.target).value)" />
                      @if (a.unidad) {
                        <span class="text-sm text-muted">{{ a.unidad }}</span>
                      }
                    </div>
                  }
                </app-admin-field>
              }
            }
          </fieldset>

          <!-- Compatibilidad -->
          @if (aplicaEquipos()) {
            <fieldset class="grid gap-3 rounded-card border border-border p-4">
              <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.compat' | transloco }}</legend>
              <p class="text-sm text-muted">{{ 'adminProduct.hint.compat' | transloco }}</p>
              @for (g of equiposPorMarca(); track g.marca.id) {
                <div>
                  <p class="text-sm font-semibold">{{ g.marca.nombre }}</p>
                  <ul class="grid gap-1">
                    @for (q of g.equipos; track q.id) {
                      <li>
                        <label class="flex min-h-11 items-center gap-2 text-sm">
                          <input type="checkbox" class="size-5" [checked]="equiposElegidos().has(q.id)" (change)="alternarEquipo(q.id)" /> {{ q.modelo }}{{ q.codigo_modelo ? ' · ' + q.codigo_modelo : '' }}
                        </label>
                      </li>
                    }
                  </ul>
                </div>
              }
            </fieldset>
          }

          <!-- Visibilidad -->
          <fieldset class="grid gap-2 rounded-card border border-border p-4">
            <legend class="px-2 text-lg font-semibold">{{ 'adminProduct.section.visibility' | transloco }}</legend>
            <p class="font-semibold">{{ (b().activo ? 'adminProduct.visibility.shown' : 'adminProduct.visibility.hidden') | transloco }}</p>
            <p class="text-sm text-muted">{{ (b().activo ? 'adminProduct.visibility.shownHelp' : 'adminProduct.visibility.hiddenHelp') | transloco }}</p>
            <button type="button" data-track="admin.producto-visibilidad" class="min-h-11 justify-self-start rounded-control border border-border-control px-4 text-sm font-semibold hover:bg-surface-muted" (click)="set('activo', !b().activo)">{{ (b().activo ? 'adminProduct.visibility.hide' : 'adminProduct.visibility.show') | transloco }}</button>
          </fieldset>

          <div class="flex flex-wrap gap-2">
            <button type="submit" data-track="admin.producto-guardar" class="min-h-11 rounded-control bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">{{ 'adminProduct.form.save' | transloco }}</button>
            <a routerLink="/admin/productos" class="inline-flex min-h-11 items-center rounded-control border border-border-control px-4 font-semibold hover:bg-surface-muted">{{ 'adminProduct.form.cancel' | transloco }}</a>
          </div>
        </form>
      }
    </div>
  `,
})
export default class ProductoForm {
  private readonly catalogo = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly lector = new DetectorLector();
  private readonly injector = inject(Injector);
  private readonly skuRuta = inject(ActivatedRoute).snapshot.paramMap.get('sku');

  protected readonly datos = this.catalogo.adminDatos();
  protected readonly esNuevo = this.skuRuta === null;
  private readonly original = this.skuRuta === null ? null : (this.datos.productos.find((p) => p.sku === this.skuRuta) ?? null);
  protected readonly noExiste = signal(this.skuRuta !== null && this.original === null);
  protected readonly condiciones = CONDICIONES;

  protected readonly b = signal<BorradorProducto>(this.original ? aBorrador(this.original) : borradorVacio());
  protected readonly errores = signal<ErroresProducto>({});
  private readonly intentado = signal(false);
  protected readonly equiposElegidos = signal<ReadonlySet<number>>(new Set(this.original ? this.catalogo.adminDatos().vinculos.filter((v) => v.producto_id === this.original!.id).map((v) => v.equipo_id) : []));
  private inicial = this.instantanea();
  private guardado = false;

  protected readonly grupos = computed(() =>
    this.datos.categorias.filter((c) => c.padre_id === null).sort((a, b) => a.orden - b.orden).map((raiz) => ({ raiz, hijas: this.datos.categorias.filter((h) => h.padre_id === raiz.id).sort((a, b) => a.orden - b.orden) })),
  );
  protected readonly atributos = computed(() => atributosDe(this.datos.atributos, this.b().categoria_id));
  protected readonly aplicaEquipos = computed(() => {
    const cat = this.datos.categorias.find((c) => c.id === this.b().categoria_id);
    const raiz = this.datos.categorias.find((c) => c.id === cat?.padre_id);
    return !!raiz && RAICES_DE_LAPTOP.includes(raiz.slug);
  });
  protected readonly equiposPorMarca = computed(() =>
    this.datos.marcas.map((marca) => ({ marca, equipos: this.datos.equipos.filter((q) => q.marca_id === marca.id).sort((x, y) => x.modelo.localeCompare(y.modelo)) })).filter((g) => g.equipos.length),
  );
  protected readonly resumen = computed(() =>
    Object.entries(this.errores()).map(([clave, codigo]) => ({ clave, codigo, etiqueta: this.etiquetaDe(clave) })),
  );

  constructor() {
    tituloDePagina(this.esNuevo ? 'adminProduct.form.titleNew' : 'adminProduct.form.titleEdit');
  }

  /** Para `canDeactivate` (CA-2.9). */
  hayCambios = (): boolean => !this.guardado && this.instantanea() !== this.inicial;

  private instantanea(): string {
    return JSON.stringify([this.b(), [...this.equiposElegidos()].sort()]);
  }

  protected id = (clave: string): string => 'pf-' + clave.replace(/\./g, '-');
  protected e = (clave: string): string | null => this.errores()[clave] ?? null;
  protected d = (clave: string, ayuda: boolean): string | null => describedBy(this.id(clave), ayuda, this.e(clave));
  protected cls = (clave: string): string => (this.e(clave) ? CAMPO_ERROR : CAMPO);

  private etiquetaDe(clave: string): string {
    if (clave.startsWith('esp.')) return this.datos.atributos.find((a) => a.categoria_id === this.b().categoria_id && a.clave === clave.slice(4))?.clave_i18n ?? 'adminProduct.section.specs';
    if (clave.startsWith('img.')) return clave.endsWith('.alt') ? 'adminProduct.field.imagenAlt' : 'adminProduct.field.imagenUrl';
    return `adminProduct.field.${clave}`;
  }

  protected set<K extends keyof BorradorProducto>(campo: K, valor: BorradorProducto[K]): void {
    this.b.update((b) => ({ ...b, [campo]: valor }));
    this.revalidar();
  }

  protected setEsp(clave: string, valor: string | boolean): void {
    this.b.update((b) => ({ ...b, especificaciones: { ...b.especificaciones, [clave]: valor } }));
    this.revalidar();
  }

  protected setImagen(i: number, campo: 'url' | 'alt', valor: string): void {
    this.b.update((b) => ({ ...b, imagenes: b.imagenes.map((img, n) => (n === i ? { ...img, [campo]: valor } : img)) }));
    this.revalidar();
  }

  protected agregarImagen(): void {
    this.b.update((b) => ({ ...b, imagenes: [...b.imagenes, { url: '', alt: '' }] }));
  }

  protected quitarImagen(i: number): void {
    this.b.update((b) => ({ ...b, imagenes: b.imagenes.filter((_, n) => n !== i) }));
    this.revalidar();
  }

  protected moverImagen(i: number, delta: -1 | 1): void {
    this.b.update((b) => {
      const imagenes = [...b.imagenes];
      [imagenes[i], imagenes[i + delta]] = [imagenes[i + delta], imagenes[i]];
      return { ...b, imagenes };
    });
  }

  protected alternarEquipo(id: number): void {
    const s = new Set(this.equiposElegidos());
    if (!s.delete(id)) s.add(id);
    this.equiposElegidos.set(s);
  }

  /** CA-3.4: avisa qué especificaciones se pierden antes de cambiar de categoría; si se rechaza, vuelve a la anterior. */
  protected cambiarCategoria(nueva: number | null, ev: Event): void {
    const pierde = especificacionesQueSePierden(this.b(), this.datos.atributos, nueva);
    if (pierde.length && !confirm(this.i18n.translate('adminProduct.form.loseSpecs', { lista: pierde.join(', ') }))) {
      (ev.target as HTMLSelectElement).value = String(this.b().categoria_id ?? '');
      return;
    }
    this.b.update((b) => ({ ...b, categoria_id: nueva, especificaciones: {} }));
    this.revalidar();
  }

  /** Un lector USB puede llenar el campo de código de barras: la ráfaga termina en Enter, que no debe enviar el formulario. */
  protected alTeclearCodigo(ev: KeyboardEvent): void {
    if (this.lector.tecla(ev.key, ev.timeStamp) || ev.key === 'Enter') ev.preventDefault();
  }

  private validar(): ErroresProducto {
    return validarProducto(this.b(), { productos: this.datos.productos, categorias: this.datos.categorias, atributos: this.datos.atributos, marcas: this.datos.marcas, skuOriginal: this.original?.sku ?? null });
  }

  private revalidar(): void {
    if (this.intentado()) this.errores.set(this.validar());
  }

  protected ir(ev: Event, clave: string): void {
    ev.preventDefault();
    document.getElementById(this.id(clave))?.focus();
  }

  protected guardar(ev: Event): void {
    ev.preventDefault();
    this.intentado.set(true);
    const errores = this.validar();
    this.errores.set(errores);
    if (Object.keys(errores).length) {
      afterNextRender(() => document.getElementById('pf-resumen')?.focus(), { injector: this.injector }); // el resumen aparece en este ciclo (CA-2.3)
      return;
    }
    const id = this.original?.id ?? Math.max(0, ...this.datos.productos.map((p) => p.id)) + 1;
    const producto = aProducto(this.b(), this.datos.atributos, { id, created_at: this.original?.created_at ?? new Date().toISOString() });
    this.catalogo.guardarProducto(producto);
    if (this.aplicaEquipos()) this.catalogo.vincularEquipos(id, [...this.equiposElegidos()]);
    this.guardado = true;
    this.toast.show('adminProduct.saved', 'exito', [], { nombre: producto.nombre });
    void this.router.navigate(['/admin/productos']);
  }
}
