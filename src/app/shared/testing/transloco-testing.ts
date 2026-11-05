import { ModuleWithProviders } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

/**
 * Transloco with no translations: every `t(key)` renders its key, so tests assert on keys and stay
 * independent of the copy in `es.json` and `pt.json`.
 */
export const translocoTesting = (): ModuleWithProviders<TranslocoTestingModule> =>
  TranslocoTestingModule.forRoot({
    langs: { es: {} },
    preloadLangs: true,
    translocoConfig: {
      availableLangs: ['es'],
      defaultLang: 'es',
      missingHandler: { logMissingKey: false },
    },
  });
