import { LOCALE_BY_LANG, SupportedLang } from '@core/const/lang.const';

/**
 * Transloco key `<base>.one` or `<base>.other`. CLDR also has a `many` form in Spanish and
 * Portuguese (only for huge round numbers), which reads correctly with the `other` text.
 */
export function pluralKey(base: string, count: number, lang: SupportedLang): string {
  const category = new Intl.PluralRules(LOCALE_BY_LANG[lang]).select(count);
  return `${base}.${category === 'one' ? 'one' : 'other'}`;
}
