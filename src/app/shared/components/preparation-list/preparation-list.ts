import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { PreparationRow } from '@domain/catalog';

/** The things to have ready before the dog arrives, with optional marks and hints (AC2.5). */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-preparation-list',
  styleUrl: './preparation-list.css',
  templateUrl: './preparation-list.html',
})
export class PreparationListComponent {
  readonly items = input.required<readonly PreparationRow[]>();
}
