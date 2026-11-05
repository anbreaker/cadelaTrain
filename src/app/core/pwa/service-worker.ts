import { EnvironmentProviders } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

import { environment } from '@environments/environment';

export interface ServiceWorkerBuild {
  /** Vite mode; Vitest runs with `test`. */
  mode: string;
  production: boolean;
}

/** `ngsw-worker.js` and its `ngsw.json` only exist in a production build (see `vite.config.ts`). */
export function isServiceWorkerEnabled(build: ServiceWorkerBuild): boolean {
  return build.production && build.mode !== 'test';
}

export function provideAppServiceWorker(): EnvironmentProviders {
  return provideServiceWorker('ngsw-worker.js', {
    enabled: isServiceWorkerEnabled({
      mode: import.meta.env.MODE,
      production: environment.production,
    }),
    // Waits for the first render so caching the app shell does not compete with it.
    registrationStrategy: 'registerWhenStable:30000',
  });
}
