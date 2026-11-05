import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { LanguageStore } from '@core/store/language.store';

/**
 * Starts downloading the active language file at bootstrap, in parallel with the lazy route chunk.
 * Without it the fetch only begins once the first `*transloco` template renders, which delays
 * the whole first paint. Transloco shares the in-flight request with later consumers.
 */
export const prefetchTranslations = (): void => {
  const lang = inject(LanguageStore).currentLang();

  inject(TranslocoService).load(lang).subscribe();
};
