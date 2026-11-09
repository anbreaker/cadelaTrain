import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Paw mark and wordmark. Decorative: the app name is announced by the page title. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-brand',
  styleUrl: './brand.css',
  templateUrl: './brand.html',
})
export class BrandComponent {
  readonly size = input<'large' | 'small'>('small');
}
