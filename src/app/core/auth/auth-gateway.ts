import { InjectionToken } from '@angular/core';

import { firebaseClient } from '@core/firebase/firebase-client';
import { AuthUser } from '@data/user-profile.converter';

import { createFirebaseAuthGateway } from './firebase-auth-gateway';

/** What the session needs from the auth provider; the seam lets the store be tested without Firebase. */
export interface AuthGateway {
  isSignInLink(url: string): boolean;
  /** Calls `listener` with the current user and on every change; returns the unsubscribe function. */
  onUserChanged(listener: (user: AuthUser | null) => void): () => void;
  sendSignInLink(email: string, continueUrl: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithLink(email: string, url: string): Promise<void>;
  signOut(): Promise<void>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('AUTH_GATEWAY', {
  factory: (): AuthGateway => createFirebaseAuthGateway(firebaseClient().auth()),
  providedIn: 'root',
});
