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

export interface EmulatorDecision {
  apiKey: string;
  flag: string | undefined;
  production: boolean;
}

/**
 * A development run without Firebase config uses the emulators instead of crashing on an empty
 * API key; a production build only ever follows the explicit flag.
 */
export function shouldUseEmulators({ apiKey, flag, production }: EmulatorDecision): boolean {
  return flag === 'true' || (!production && apiKey.length === 0);
}

/**
 * With emulators on, the real config is ignored on purpose: a `demo-` project id guarantees that a
 * local run never reaches a real project, even when `.env.local` holds production values.
 */
function resolveOptions({ config, useEmulators }: FirebaseClientOptions): FirebaseOptions {
  return useEmulators ? { apiKey: 'demo-api-key', projectId: EMULATOR_PROJECT_ID } : config;
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

  // Each service is cached only after its emulator connection succeeds, so a failed connect is
  // retried instead of leaving a cached instance that silently talks to the wrong backend.
  return {
    auth(): Auth {
      if (auth) return auth;
      const instance = sdk.getAuth(getApp());
      if (options.useEmulators) {
        sdk.connectAuthEmulator(instance, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
          disableWarnings: true,
        });
      }
      auth = instance;
      return auth;
    },
    firestore(): Firestore {
      if (firestore) return firestore;
      const instance = sdk.getFirestore(getApp());
      if (options.useEmulators) {
        sdk.connectFirestoreEmulator(instance, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
      }
      firestore = instance;
      return firestore;
    },
  };
}

let appClient: FirebaseClient | undefined;

/** App-wide client built from `environment.firebase` and `NG_APP_USE_EMULATORS`. */
export function firebaseClient(): FirebaseClient {
  return (appClient ??= createFirebaseClient({
    config: environment.firebase,
    useEmulators: shouldUseEmulators({
      apiKey: environment.firebase.apiKey,
      flag: import.meta.env.NG_APP_USE_EMULATORS,
      production: environment.production,
    }),
  }));
}
