import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

export interface SegmentOption<T extends string> {
  /** Transloco key of the visible label. */
  labelKey: string;
  value: T;
}

/** Two or more mutually exclusive choices as toggle buttons (`aria-pressed`), inside a labelled fieldset. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-segmented-control',
  styleUrl: './segmented-control.css',
  templateUrl: './segmented-control.html',
})
export class SegmentedControlComponent<T extends string> {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = input.required<T>();

  readonly valueChange = output<T>();
}
