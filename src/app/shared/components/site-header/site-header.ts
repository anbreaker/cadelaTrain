import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { SupportedLang } from '@core/const/lang.const';
import { ScreenPoint } from '@core/utils/theme-transition';
import { BrandComponent } from '@shared/components/brand/brand';
import { LangSelectorComponent } from '@shared/components/lang-selector/lang-selector';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle';

export interface NavItem {
  labelKey: string;
  path: string;
}

/** On `<body>` while the mobile menu is open; `styles/base/reset.css` locks the page scroll with it. */
const MENU_OPEN_CLASS = 'menu-open';

/**
 * Header of every screen: brand, then navigation, language and theme. From 768px they sit in the
 * bar; below, they live in a panel behind a menu button. The container owns every state but the
 * menu's own open/closed state.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrandComponent,
    LangSelectorComponent,
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    TranslocoDirective,
  ],
  selector: 'app-site-header',
  styleUrl: './site-header.css',
  templateUrl: './site-header.html',
  host: { '(keydown.escape)': 'closeAndFocusButton()' },
})
export class SiteHeaderComponent {
  private readonly document = inject(DOCUMENT);

  readonly isDark = input.required<boolean>();
  readonly lang = input.required<SupportedLang>();
  readonly navItems = input<readonly NavItem[]>([]);
  readonly signedIn = input(false);

  readonly langChange = output<SupportedLang>();
  readonly signOut = output<void>();
  readonly themeToggle = output<ScreenPoint>();

  private readonly _menuOpen = signal(false);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  protected readonly menuOpen = this._menuOpen.asReadonly();

  constructor() {
    effect(() => this.document.body.classList.toggle(MENU_OPEN_CLASS, this._menuOpen()));
    inject(DestroyRef).onDestroy(() => this.document.body.classList.remove(MENU_OPEN_CLASS));
  }

  protected toggleMenu(): void {
    this._menuOpen.update((isOpen) => !isOpen);
  }

  protected closeMenu(): void {
    this._menuOpen.set(false);
  }

  protected closeAndFocusButton(): void {
    if (!this._menuOpen()) return;

    this.closeMenu();
    this.menuButton().nativeElement.focus();
  }

  protected requestSignOut(): void {
    this.closeMenu();
    this.signOut.emit();
  }
}
