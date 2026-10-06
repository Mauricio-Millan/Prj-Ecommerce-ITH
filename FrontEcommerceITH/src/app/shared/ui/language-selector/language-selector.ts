import { CdkMenu, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-language-selector',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItemRadio, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      data-zone="selector-idioma"
      data-track="selector-idioma.abrir"
      class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-1 text-sm hover:bg-surface-muted sm:px-2"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="('language.label' | transloco) + ': ' + actual().nativeName"
    >
      <app-icon name="idioma" [size]="18" />
      <span class="uppercase">{{ actual().code.slice(0, 2) }}</span>
      <span class="hidden sm:inline-flex"><app-icon name="desplegar" [size]="16" /></span>
    </button>

    <ng-template #menu>
      <div cdkMenu class="min-w-40 rounded-card border border-border bg-surface p-1 shadow-overlay">
        @for (idioma of language.enabled; track idioma.code) {
          <button
            cdkMenuItemRadio
            type="button"
            class="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm hover:bg-surface-muted focus:bg-surface-muted aria-checked:font-semibold"
            [attr.lang]="idioma.code"
            [attr.data-track]="'selector-idioma.' + idioma.code"
            [cdkMenuItemChecked]="idioma.code === language.lang()"
            (cdkMenuItemTriggered)="language.setLang(idioma.code)"
          >
            {{ idioma.nativeName }}
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class LanguageSelector {
  protected readonly language = inject(LanguageService);
  protected readonly actual = computed(() => this.language.enabled.find((l) => l.code === this.language.lang())!);
}
