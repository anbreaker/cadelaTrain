import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';

import { DEFAULT_LANG, SUPPORTED_LANGS } from '@core/const/lang.const';
import { DOCUMENT_RELOADER } from '@core/pwa/app-update.store';
import { provideAppServiceWorker } from '@core/pwa/service-worker';
import { withChunkLoadRecovery } from '@core/router/chunk-load-recovery';
import { I18nLoaderService } from '@core/services/i18n-loader.service';
import { provideSessionRedirect } from '@core/session/session-routes';
import { NOW } from '@core/time/now';
import { reloadOnNewDay } from '@core/time/reload-on-new-day';
import { prefetchTranslations } from '@core/utils/prefetch-translations';
import {
  skipSamePageTransitions,
  startTransitionsOnlyWhenVisible,
} from '@core/utils/view-transition';
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
    provideAppInitializer(() => startTransitionsOnlyWhenVisible(inject(DOCUMENT))),
    provideAppInitializer(() => {
      reloadOnNewDay(inject(DOCUMENT), inject(NOW), inject(DOCUMENT_RELOADER));
    }),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withComponentInputBinding(),
      withChunkLoadRecovery(),
      withViewTransitions({ onViewTransitionCreated: skipSamePageTransitions })
    ),
    provideSessionRedirect(),
    provideAppServiceWorker(),
  ],
};
