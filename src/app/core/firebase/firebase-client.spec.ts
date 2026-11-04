import { FirebaseEnvironment } from '@environments/environment.model';

import {
  createFirebaseClient,
  EMULATOR_PROJECT_ID,
  FirebaseSdk,
  shouldUseEmulators,
} from './firebase-client';

import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

const CONFIG: FirebaseEnvironment = {
  apiKey: 'key',
  appId: 'app',
  authDomain: 'dela.firebaseapp.com',
  messagingSenderId: '1',
  projectId: 'dela-prod',
  storageBucket: 'dela.appspot.com',
};

const EMPTY_CONFIG: FirebaseEnvironment = {
  apiKey: '',
  appId: '',
  authDomain: '',
  messagingSenderId: '',
  projectId: '',
  storageBucket: '',
};

function fakeSdk() {
  const app = { name: 'app' } as FirebaseApp;
  const auth = { name: 'auth' } as unknown as Auth;
  const firestore = { type: 'firestore' } as Firestore;
  return {
    app,
    auth,
    firestore,
    sdk: {
      connectAuthEmulator: vi.fn(),
      connectFirestoreEmulator: vi.fn(),
      getAuth: vi.fn(() => auth),
      getFirestore: vi.fn(() => firestore),
      initializeApp: vi.fn(() => app),
    } satisfies FirebaseSdk,
  };
}

describe('shouldUseEmulators', () => {
  it('should use the emulators only when the flag is exactly "true"', () => {
    expect(shouldUseEmulators('true')).toBe(true);
    expect(shouldUseEmulators('false')).toBe(false);
    expect(shouldUseEmulators('TRUE')).toBe(false);
    expect(shouldUseEmulators(undefined)).toBe(false);
  });
});

describe('createFirebaseClient', () => {
  it('should not initialize Firebase until a service is requested', () => {
    const { sdk } = fakeSdk();

    createFirebaseClient({ config: CONFIG, useEmulators: false }, sdk);

    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  it('should connect to the real project when emulators are off', () => {
    const { app, auth, firestore, sdk } = fakeSdk();
    const client = createFirebaseClient({ config: CONFIG, useEmulators: false }, sdk);

    expect(client.auth()).toBe(auth);
    expect(client.firestore()).toBe(firestore);
    expect(sdk.initializeApp).toHaveBeenCalledWith(CONFIG);
    expect(sdk.getAuth).toHaveBeenCalledWith(app);
    expect(sdk.getFirestore).toHaveBeenCalledWith(app);
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled();
    expect(sdk.connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('should connect each service to its emulator once when emulators are on', () => {
    const { auth, firestore, sdk } = fakeSdk();
    const client = createFirebaseClient({ config: CONFIG, useEmulators: true }, sdk);

    client.auth();
    client.auth();
    client.firestore();
    client.firestore();

    expect(sdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledWith(firestore, '127.0.0.1', 8080);
  });

  it('should fall back to the demo project when emulators are on without config', () => {
    const { sdk } = fakeSdk();
    const client = createFirebaseClient({ config: EMPTY_CONFIG, useEmulators: true }, sdk);

    client.firestore();

    expect(sdk.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'demo-api-key', projectId: EMULATOR_PROJECT_ID })
    );
  });

  it('should always use the demo project when emulators are on, even with a real config', () => {
    const { sdk } = fakeSdk();
    const client = createFirebaseClient({ config: CONFIG, useEmulators: true }, sdk);

    client.firestore();

    expect(sdk.initializeApp).toHaveBeenCalledWith({
      apiKey: 'demo-api-key',
      projectId: EMULATOR_PROJECT_ID,
    });
  });

  it('should retry the emulator connection instead of caching a service that failed to connect', () => {
    const { sdk } = fakeSdk();
    sdk.connectFirestoreEmulator.mockImplementationOnce(() => {
      throw new Error('Firestore has already been started');
    });
    const client = createFirebaseClient({ config: CONFIG, useEmulators: true }, sdk);

    expect(() => client.firestore()).toThrow('already been started');
    client.firestore();

    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledTimes(2);
  });

  it('should keep an empty config when emulators are off', () => {
    const { sdk } = fakeSdk();
    const client = createFirebaseClient({ config: EMPTY_CONFIG, useEmulators: false }, sdk);

    client.firestore();

    expect(sdk.initializeApp).toHaveBeenCalledWith(EMPTY_CONFIG);
  });
});
