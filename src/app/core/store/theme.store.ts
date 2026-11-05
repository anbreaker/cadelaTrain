import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

import {
  DEFAULT_THEME,
  Theme,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  THEMES,
} from '@core/const/theme.const';
import { runThemeTransition, ScreenPoint } from '@core/utils/theme-transition';

const NEXT_THEME: Record<Theme, Theme> = { dark: 'light', light: 'dark' };

const isTheme = (value: string | null): value is Theme => THEMES.some((theme) => theme === value);

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Per-device theme. `index.html` applies a stored theme before the first paint; this keeps it in sync. */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly document = inject(DOCUMENT);

  private readonly _theme = signal<Theme>(readStoredTheme());

  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    this.apply(this._theme());
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
    this.apply(theme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for the session only.
    }
  }

  /** With an `origin` (the click point) the new theme is revealed in a circle growing from it. */
  toggle(origin?: ScreenPoint): void {
    const change = (): void => this.setTheme(NEXT_THEME[this._theme()]);
    if (origin) runThemeTransition(this.document, origin, change);
    else change();
  }

  private apply(theme: Theme): void {
    this.document.documentElement.dataset['theme'] = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
  }
}
