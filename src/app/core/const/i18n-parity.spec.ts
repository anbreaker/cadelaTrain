import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SUPPORTED_LANGS } from './lang.const';

type TranslationTree = { [key: string]: string | TranslationTree };

const readTranslations = (lang: string): TranslationTree =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `public/assets/i18n/${lang}.json`), 'utf-8')
  ) as TranslationTree;

const flattenKeys = (tree: TranslationTree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flattenKeys(value, `${prefix}${key}.`)
  );

describe('i18n translation files', () => {
  const referenceKeys = flattenKeys(readTranslations('es')).sort();

  it('should provide a non-empty reference file', () => {
    expect(referenceKeys.length).toBeGreaterThan(0);
  });

  SUPPORTED_LANGS.forEach((lang) => {
    it(`should expose exactly the same keys in ${lang}.json as in es.json`, () => {
      expect(flattenKeys(readTranslations(lang)).sort()).toEqual(referenceKeys);
    });
  });
});
