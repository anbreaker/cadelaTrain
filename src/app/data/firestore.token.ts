import { InjectionToken } from '@angular/core';

import { firebaseClient } from '@core/firebase/firebase-client';

import { Firestore } from 'firebase/firestore';

/** Seam for repositories: the app gets the lazy client, emulator tests pass their own instance. */
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE', {
  factory: (): Firestore => firebaseClient().firestore(),
  providedIn: 'root',
});
