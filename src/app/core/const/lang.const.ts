export const SUPPORTED_LANGS = ['en', 'es', 'pt'] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = 'es';

export const LANG_STORAGE_KEY = 'dela-lang';

/** Regional locale used by `Intl` for dates, numbers and plural rules: US English, Castilian Spanish and European Portuguese. */
export const LOCALE_BY_LANG: Record<SupportedLang, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-PT',
};

/** Each language named in itself, so a user who cannot read the current UI still finds theirs. */
export const LANG_NAMES: Record<SupportedLang, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

export const LANG_FLAGS: Record<SupportedLang, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  pt: '🇵🇹',
};
