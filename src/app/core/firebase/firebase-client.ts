import { environment } from '@environments/environment';
import { FirebaseEnvironment } from '@environments/environment.model';

import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';

/** Must match `firebase.json` (emulator ports) and the `demo-` project of `npm run test:rules`. */
export const EMULATOR_HOST = '127.0.0.1';
export const AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8080;
export const EMULATOR_PROJECT_ID = 'demo-dela';

/** The SDK functions used here, injectable so the emulator decision is testable without Firebase. */
export interface FirebaseSdk {
  connectAuthEmulator: typeof connectAuthEmulator;
  connectFirestoreEmulator: typeof connectFirestoreEmulator;
  getAuth: typeof getAuth;
  getFirestore: typeof getFirestore;
  initializeApp: typeof initializeApp;
}

export interface FirebaseClientOptions {
  config: FirebaseEnvironment;
  useEmulators: boolean;
}

export interface FirebaseClient {
  auth(): Auth;
  firestore(): Firestore;
}

const firebaseSdk: FirebaseSdk = {
  connectAuthEmulator,
  connectFirestoreEmulator,
  getAuth,
  getFirestore,
  initializeApp,
};

export function shouldUseEmulators(flag: string | undefined): boolean {
  return flag === 'true';
}

/** A `demo-` project id keeps an unconfigured local run from ever reaching a real project. */
function resolveOptions({ config, useEmulators }: FirebaseClientOptions): FirebaseOptions {
  return useEmulators
    ? {
        ...config,
        apiKey: config.apiKey || 'demo-api-key',
        projectId: config.projectId || EMULATOR_PROJECT_ID,
      }
    : config;
}

/** Initializes Firebase on the first service request and connects each service once. */
export function createFirebaseClient(
  options: FirebaseClientOptions,
  sdk: FirebaseSdk = firebaseSdk
): FirebaseClient {
  let app: FirebaseApp | undefined;
  let auth: Auth | undefined;
  let firestore: Firestore | undefined;

  const getApp = (): FirebaseApp => (app ??= sdk.initializeApp(resolveOptions(options)));

  return {
    auth(): Auth {
      if (auth) return auth;
      auth = sdk.getAuth(getApp());
      if (options.useEmulators) {
        sdk.connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
          disableWarnings: true,
        });
      }
      return auth;
    },
    firestore(): Firestore {
      if (firestore) return firestore;
      firestore = sdk.getFirestore(getApp());
      if (options.useEmulators) {
        sdk.connectFirestoreEmulator(firestore, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
      }
      return firestore;
    },
  };
}

let appClient: FirebaseClient | undefined;

/** App-wide client built from `environment.firebase` and `NG_APP_USE_EMULATORS`. */
export function firebaseClient(): FirebaseClient {
  return (appClient ??= createFirebaseClient({
    config: environment.firebase,
    useEmulators: shouldUseEmulators(import.meta.env.NG_APP_USE_EMULATORS),
  }));
}
