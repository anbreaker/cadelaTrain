import { InjectionToken } from '@angular/core';

import { firebaseClient } from '@core/firebase/firebase-client';
import { AuthUser } from '@data/user-profile.converter';

import { createFirebaseAuthGateway } from './firebase-auth-gateway';

/** What the session needs from the auth provider; the seam lets the store be tested without Firebase. */
export interface AuthGateway {
  /** The signed-in user's Firebase ID token for `api/` calls; `null` when signed out. */
  idToken(): Promise<null | string>;
  /** Calls `listener` with the current user and on every change; returns the unsubscribe function. */
  onUserChanged(listener: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** Asks the auth server whether the signed-in account still exists; rejects with its error code. */
  verifyUser(): Promise<void>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('AUTH_GATEWAY', {
  factory: (): AuthGateway => createFirebaseAuthGateway(firebaseClient().auth()),
  providedIn: 'root',
});
