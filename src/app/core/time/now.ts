import { InjectionToken } from '@angular/core';

/** Current time, injectable so screens that depend on "today" can be tested on fixed dates. */
export const NOW = new InjectionToken<() => Date>('NOW', {
  factory: () => (): Date => new Date(),
  providedIn: 'root',
});
