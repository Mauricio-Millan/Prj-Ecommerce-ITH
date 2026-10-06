import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Provisional hasta la spec 009. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold">{{ 'admin.title' | transloco }}</h1>
    <p class="mt-2 text-muted">{{ 'admin.dashboardBody' | transloco }}</p>
  `,
})
export default class Dashboard {}
