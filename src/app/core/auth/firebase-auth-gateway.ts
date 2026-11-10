import { AuthUser } from '@data/user-profile.converter';

import type { AuthGateway } from './auth-gateway';

import {
  Auth,
  getIdToken,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';

/** Accounts without an email (anonymous, phone) cannot use the app: invitations are keyed by email. */
const toAuthUser = (user: User | null): AuthUser | null =>
  user?.email ? { displayName: user.displayName, email: user.email, uid: user.uid } : null;

export function createFirebaseAuthGateway(auth: Auth): AuthGateway {
  return {
    idToken: async (): Promise<null | string> =>
      auth.currentUser ? getIdToken(auth.currentUser) : null,
    onUserChanged: (listener) => onAuthStateChanged(auth, (user) => listener(toAuthUser(user))),
    signInWithGoogle: async (): Promise<void> => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: () => signOut(auth),
    verifyUser: async (): Promise<void> => {
      if (auth.currentUser) await reload(auth.currentUser);
    },
  };
}
