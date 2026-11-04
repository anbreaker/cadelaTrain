import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AppUpdateStore } from '@core/pwa/app-update.store';
import { UpdateBannerComponent } from '@shared/components/update-banner/update-banner';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TranslocoDirective, UpdateBannerComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class AppComponent {
  private readonly appUpdate = inject(AppUpdateStore);

  protected readonly updateReady = this.appUpdate.updateReady;

  protected applyUpdate(): void {
    void this.appUpdate.applyUpdate();
  }
}
