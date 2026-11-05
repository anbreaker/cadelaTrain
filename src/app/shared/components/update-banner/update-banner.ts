import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

/** Tells the user a new version is downloaded; the container decides what reloading does. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-update-banner',
  styleUrl: './update-banner.css',
  templateUrl: './update-banner.html',
})
export class UpdateBannerComponent {
  readonly reload = output<void>();
}
