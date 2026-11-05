import { AuthUser } from '@data/user-profile.converter';

import type { AuthGateway } from './auth-gateway';

import {
  Auth,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  reload,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';

/** Accounts without an email (anonymous, phone) cannot use the app: invitations are keyed by email. */
const toAuthUser = (user: User | null): AuthUser | null =>
  user?.email ? { displayName: user.displayName, email: user.email, uid: user.uid } : null;

export function createFirebaseAuthGateway(auth: Auth): AuthGateway {
  return {
    isSignInLink: (url) => isSignInWithEmailLink(auth, url),
    onUserChanged: (listener) => onAuthStateChanged(auth, (user) => listener(toAuthUser(user))),
    sendSignInLink: (email, continueUrl) =>
      sendSignInLinkToEmail(auth, email, { handleCodeInApp: true, url: continueUrl }),
    signInWithGoogle: async (): Promise<void> => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signInWithLink: async (email, url): Promise<void> => {
      await signInWithEmailLink(auth, email, url);
    },
    signOut: () => signOut(auth),
    verifyUser: async (): Promise<void> => {
      if (auth.currentUser) await reload(auth.currentUser);
    },
  };
}
