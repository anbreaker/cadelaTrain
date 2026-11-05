import { filter, map } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { SupportedLang } from '@core/const/lang.const';
import { AppUpdateStore } from '@core/pwa/app-update.store';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { ThemeStore } from '@core/store/theme.store';
import { ScreenPoint } from '@core/utils/theme-transition';
import { BrandComponent } from '@shared/components/brand/brand';
import { NavItem, SiteHeaderComponent } from '@shared/components/site-header/site-header';
import { UpdateBannerComponent } from '@shared/components/update-banner/update-banner';

/** Only screens that exist are listed; later stories add progress and the weekly review. */
const NAV_ITEMS: readonly NavItem[] = [
  { labelKey: 'nav.today', path: '/today' },
  { labelKey: 'nav.household', path: '/household' },
];

const isNavigationBoundary = (event: unknown): boolean =>
  event instanceof NavigationStart ||
  event instanceof NavigationEnd ||
  event instanceof NavigationCancel ||
  event instanceof NavigationError ||
  event instanceof NavigationSkipped;

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrandComponent,
    RouterOutlet,
    SiteHeaderComponent,
    TranslocoDirective,
    UpdateBannerComponent,
  ],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class AppComponent {
  private readonly appUpdate = inject(AppUpdateStore);
  private readonly session = inject(AuthSessionStore);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageStore);
  private readonly theme = inject(ThemeStore);

  private readonly navigating = toSignal(
    this.router.events.pipe(
      filter(isNavigationBoundary),
      map((event) => event instanceof NavigationStart)
    ),
    { initialValue: true }
  );

  protected readonly updateReady = this.appUpdate.updateReady;
  protected readonly lang = this.language.currentLang;
  protected readonly isDark = this.theme.isDark;
  protected readonly signedIn = computed(() => this.session.user() !== null);
  /** The app sections exist only once the household has its puppy; onboarding shows no navigation. */
  protected readonly navItems = computed((): readonly NavItem[] =>
    this.session.status() === 'ready' ? NAV_ITEMS : []
  );
  /**
   * A calm surface covers the screen while the session loads or a redirect is on its way, so the
   * sign-in screen never flashes before the user's real screen. It fades in only after a delay (CSS).
   */
  protected readonly busy = computed(
    () => this.session.status() === 'loading' || this.navigating()
  );

  protected applyUpdate(): void {
    void this.appUpdate.applyUpdate();
  }

  protected setLang(lang: SupportedLang): void {
    void this.session.setLocale(lang);
  }

  protected toggleTheme(origin: ScreenPoint): void {
    this.theme.toggle(origin);
  }

  protected signOut(): void {
    void this.session.signOut();
  }
}
