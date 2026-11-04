import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';

import { DEFAULT_LANG, SUPPORTED_LANGS } from '@core/const/lang.const';
import { withChunkLoadRecovery } from '@core/router/chunk-load-recovery';
import { I18nLoaderService } from '@core/services/i18n-loader.service';
import { prefetchTranslations } from '@core/utils/prefetch-translations';
import { environment } from '@environments/environment';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withXhr()),
    provideTransloco({
      config: {
        availableLangs: [...SUPPORTED_LANGS],
        defaultLang: DEFAULT_LANG,
        fallbackLang: DEFAULT_LANG,
        prodMode: environment.production,
        reRenderOnLangChange: true,
      },
      loader: I18nLoaderService,
    }),
    provideAppInitializer(prefetchTranslations),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withComponentInputBinding(),
      withChunkLoadRecovery()
    ),
  ],
};
