import { filter, firstValueFrom, Observable } from 'rxjs';
import { Injector, runInInjectionContext } from '@angular/core';

import { FIRESTORE } from '@data/firestore.token';

import { Firestore } from 'firebase/firestore';

/**
 * Builds a repository bound to an emulator context. Constructing it inside an injection context
 * runs its `inject(FIRESTORE)` without the Angular compiler, which this node suite does not load.
 */
export function repositoryFor<T>(Repository: new () => T, db: Firestore): T {
  const injector = Injector.create({ providers: [{ provide: FIRESTORE, useValue: db }] });
  return runInInjectionContext(injector, () => new Repository());
}

export function firstMatching<T>(
  source: Observable<T>,
  matches: (value: T) => boolean
): Promise<T> {
  return firstValueFrom(source.pipe(filter(matches)));
}
