import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  SUPPORTED_LANGS,
  SupportedLang,
} from '@core/const/lang.const';

function isSupportedLang(value: string | null): value is SupportedLang {
  return SUPPORTED_LANGS.some((lang) => lang === value);
}

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function resolveInitialLang(): SupportedLang {
  const stored = readStoredLang();
  if (isSupportedLang(stored)) return stored;

  const browserLang = navigator.language.slice(0, 2);
  if (isSupportedLang(browserLang)) return browserLang;

  return DEFAULT_LANG;
}

@Injectable({ providedIn: 'root' })
export class LanguageStore {
  private readonly transloco = inject(TranslocoService);

  private readonly _currentLang = signal<SupportedLang>(resolveInitialLang());

  readonly currentLang = this._currentLang.asReadonly();
  readonly supportedLangs = SUPPORTED_LANGS;

  constructor() {
    this.applyLang(this._currentLang());
  }

  setLang(lang: SupportedLang): void {
    this._currentLang.set(lang);
    this.applyLang(lang);

    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for the session only.
    }
  }

  private applyLang(lang: SupportedLang): void {
    this.transloco.setActiveLang(lang);
    document.documentElement.lang = lang;
  }
}
