export const SUPPORTED_LANGS = ['es', 'pt'] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = 'es';

export const LANG_STORAGE_KEY = 'dela-lang';

/** Regional locale used by `Intl` for dates, numbers and plural rules: Castilian Spanish and European Portuguese. */
export const LOCALE_BY_LANG: Record<SupportedLang, string> = {
  es: 'es-ES',
  pt: 'pt-PT',
};
