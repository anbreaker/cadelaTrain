import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

/** Full-screen notice for a signed-in user whose data cannot be reached; the container retries. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-unavailable-state',
  styleUrl: './unavailable-state.css',
  templateUrl: './unavailable-state.html',
})
export class UnavailableStateComponent {
  readonly retry = output<void>();
}
