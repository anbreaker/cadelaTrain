import { Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AUTH_GATEWAY, AuthGateway } from '@core/auth/auth-gateway';
import { LanguageStore } from '@core/store/language.store';
import { DogRepository } from '@data/dog.repository';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { AuthUser, UserProfile } from '@data/user-profile.converter';
import { UserProfileRepository } from '@data/user-profile.repository';
import { Dog } from '@domain/dog';
import { Household, Locale } from '@domain/household';

import { AuthSessionStore, DOGS_RETRY_DELAY_MS, PROFILE_TIMEOUT_MS } from './auth-session.store';

const ana: AuthUser = { displayName: 'Ana', email: 'Ana@Example.com', uid: 'ana' };

const household: Household = {
  id: 'h1',
  locale: 'es',
  memberIds: ['ana'],
  members: { ana: { displayName: 'Ana', role: 'owner' } },
  name: 'Finca El Encinar',
  ownerId: 'ana',
  timezone: 'Europe/Madrid',
};

const dela: Dog = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  id: 'd1',
  name: 'Dela',
  notes: '',
  planWeek: 1,
  sleepsOutdoors: true,
};

const invitation: Invitation = {
  email: 'ana@example.com',
  householdId: 'h9',
  householdName: 'Casa de Jéssica',
  invitedBy: 'jess',
};

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('AuthSessionStore', () => {
  let emitUser: (user: AuthUser | null) => void;
  let gateway: { [K in keyof AuthGateway]: ReturnType<typeof vi.fn> };
  let households$: Subject<Household[]>;
  let dogs$: Subject<Dog[]>;
  let profileLocale: Locale | null;
  let pendingInvitations: Invitation[];
  let profiles: { ensureProfile: ReturnType<typeof vi.fn>; setLocale: ReturnType<typeof vi.fn> };
  let householdRepo: {
    pendingInvitationsFor: ReturnType<typeof vi.fn>;
    watchForMember: ReturnType<typeof vi.fn>;
  };
  let dogRepo: { watchAll: ReturnType<typeof vi.fn> };
  let language: {
    currentLang: ReturnType<typeof signal<Locale>>;
    setLang: ReturnType<typeof vi.fn>;
  };

  const createStore = (): AuthSessionStore => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_GATEWAY, useValue: gateway },
        { provide: UserProfileRepository, useValue: profiles },
        { provide: HouseholdRepository, useValue: householdRepo },
        { provide: DogRepository, useValue: dogRepo },
        { provide: LanguageStore, useValue: language },
      ],
    });
    return TestBed.inject(AuthSessionStore);
  };

  const signIn = async (store: AuthSessionStore): Promise<AuthSessionStore> => {
    emitUser(ana);
    await flush();
    return store;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    households$ = new Subject<Household[]>();
    dogs$ = new Subject<Dog[]>();
    profileLocale = null;
    pendingInvitations = [];
    gateway = {
      isSignInLink: vi.fn(() => true),
      onUserChanged: vi.fn((listener: (user: AuthUser | null) => void) => {
        emitUser = listener;
        return (): void => undefined;
      }),
      sendSignInLink: vi.fn(async () => undefined),
      signInWithGoogle: vi.fn(async () => undefined),
      signInWithLink: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      verifyUser: vi.fn(async () => undefined),
    };
    profiles = {
      ensureProfile: vi.fn(async (user: AuthUser, locale: Locale): Promise<UserProfile> => ({
        displayName: user.displayName ?? '',
        email: user.email.toLowerCase(),
        locale: profileLocale ?? locale,
        uid: user.uid,
      })),
      setLocale: vi.fn(async () => undefined),
    };
    householdRepo = {
      pendingInvitationsFor: vi.fn(async () => pendingInvitations),
      watchForMember: vi.fn(() => households$),
    };
    dogRepo = { watchAll: vi.fn(() => dogs$) };
    language = { currentLang: signal<Locale>('pt'), setLang: vi.fn() };
  });

  afterEach(() => vi.useRealTimers());

  it('should be loading until the auth state is known, then signed out without a user', () => {
    const store = createStore();

    expect(store.status()).toBe('loading');

    emitUser(null);

    expect(store.status()).toBe('signedOut');
    expect(store.user()).toBeNull();
  });

  it('should create the profile with the UI language on sign-in and apply the stored locale', async () => {
    profileLocale = 'es';
    const store = await signIn(createStore());

    expect(profiles.ensureProfile).toHaveBeenCalledWith(ana, 'pt');
    expect(language.setLang).toHaveBeenCalledWith('es');
    expect(store.profile()?.locale).toBe('es');
    expect(store.status()).toBe('loading');
  });

  it('should need a household when the user belongs to none and has no invitation', async () => {
    const store = await signIn(createStore());

    households$.next([]);
    await flush();

    expect(householdRepo.pendingInvitationsFor).toHaveBeenCalledWith(ana.email);
    expect(store.status()).toBe('needsHousehold');
    expect(store.invitations()).toEqual([]);
  });

  it('should expose pending invitations while the user has no household', async () => {
    pendingInvitations = [invitation];
    const store = await signIn(createStore());

    households$.next([]);
    await flush();

    expect(store.status()).toBe('needsHousehold');
    expect(store.invitations()).toEqual([invitation]);
  });

  it('should stay loading until the dog list arrives, then need a dog', async () => {
    const store = await signIn(createStore());

    households$.next([household]);
    await flush();

    expect(store.household()).toEqual(household);
    expect(store.status()).toBe('loading');
    expect(dogRepo.watchAll).toHaveBeenCalledWith('h1');

    dogs$.next([]);

    expect(store.status()).toBe('needsDog');
    expect(store.isOwner()).toBe(true);
  });

  it('should be ready once the household has a dog', async () => {
    const store = await signIn(createStore());

    households$.next([household]);
    dogs$.next([dela]);
    await flush();

    expect(store.status()).toBe('ready');
    expect(store.dog()).toEqual(dela);
  });

  it('should retry the dogs while a just-created membership reaches the server', async () => {
    vi.useFakeTimers();
    const denied$ = new Subject<Dog[]>();
    dogRepo.watchAll.mockReturnValueOnce(denied$);
    const store = createStore();
    emitUser(ana);
    await vi.advanceTimersByTimeAsync(0);

    households$.next([household]);
    denied$.error(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    await vi.advanceTimersByTimeAsync(DOGS_RETRY_DELAY_MS);
    dogs$.next([dela]);

    expect(dogRepo.watchAll).toHaveBeenCalledTimes(2);
    expect(store.error()).toBeNull();
    expect(store.status()).toBe('ready');
    vi.useRealTimers();
  });

  it('should not reload the dogs when only the household data changes', async () => {
    const store = await signIn(createStore());
    households$.next([household]);
    dogs$.next([dela]);
    await flush();

    households$.next([{ ...household, name: 'El Encinar' }]);
    await flush();

    expect(dogRepo.watchAll).toHaveBeenCalledTimes(1);
    expect(store.household()?.name).toBe('El Encinar');
    expect(store.status()).toBe('ready');
  });

  it('should go from needing a household to loading (not needing a dog) when one appears', async () => {
    const store = await signIn(createStore());
    households$.next([]);
    await flush();

    households$.next([household]);

    expect(store.status()).toBe('loading');
  });

  it('should clear the session and stop listening on sign-out', async () => {
    const store = await signIn(createStore());
    households$.next([household]);
    dogs$.next([dela]);
    await flush();

    emitUser(null);
    households$.next([household]);

    expect(store.status()).toBe('signedOut');
    expect(store.household()).toBeNull();
    expect(store.dog()).toBeNull();
    expect(store.profile()).toBeNull();
    expect(households$.observed).toBe(false);
  });

  const firebaseError = (code: string): Error & { code: string } =>
    Object.assign(new Error(code), { code });

  it('should sign out when the session itself is no longer valid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('auth/user-token-expired'));
    const store = await signIn(createStore());

    expect(store.error()).toBe('sessionFailed');
    expect(gateway.signOut).toHaveBeenCalledTimes(1);
    expect(store.status()).toBe('signedOut');
  });

  it('should keep the user signed in and report unavailable when Firestore cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('unavailable'));
    const store = await signIn(createStore());

    expect(store.status()).toBe('unavailable');
    expect(store.user()).toEqual(ana);
    expect(store.error()).toBeNull();
    expect(gateway.signOut).not.toHaveBeenCalled();
  });

  it('should report unavailable, not sign out, when the profile does not load in time', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockReturnValueOnce(new Promise<UserProfile>(() => undefined));
    const store = createStore();
    emitUser(ana);

    await vi.advanceTimersByTimeAsync(PROFILE_TIMEOUT_MS - 1);
    expect(store.status()).toBe('loading');

    await vi.advanceTimersByTimeAsync(1);

    expect(store.status()).toBe('unavailable');
    expect(gateway.signOut).not.toHaveBeenCalled();
  });

  it('should sign out when the profile does not load and the auth server no longer knows the user', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockReturnValueOnce(new Promise<UserProfile>(() => undefined));
    gateway.verifyUser.mockRejectedValueOnce(firebaseError('auth/user-not-found'));
    const store = createStore();
    emitUser(ana);

    await vi.advanceTimersByTimeAsync(PROFILE_TIMEOUT_MS);

    expect(gateway.verifyUser).toHaveBeenCalledTimes(1);
    expect(gateway.signOut).toHaveBeenCalledTimes(1);
    expect(store.error()).toBe('sessionFailed');
    expect(store.status()).toBe('signedOut');
  });

  it('should report sessionFailed when the auth check signs the user out before rejecting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Firebase `reload` signs an invalidated user out first, then rethrows.
    gateway.verifyUser.mockImplementationOnce(async () => {
      emitUser(null);
      throw firebaseError('auth/user-token-expired');
    });
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('unavailable'));
    const store = await signIn(createStore());

    expect(store.error()).toBe('sessionFailed');
    expect(store.status()).toBe('signedOut');
  });

  it('should stay unavailable when the auth server cannot be reached either', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('unavailable'));
    gateway.verifyUser.mockRejectedValueOnce(firebaseError('auth/network-request-failed'));
    const store = await signIn(createStore());

    expect(gateway.verifyUser).toHaveBeenCalledTimes(1);
    expect(store.status()).toBe('unavailable');
    expect(gateway.signOut).not.toHaveBeenCalled();
  });

  it('should ignore a late invalid check once the session was retried', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectCheck: (error: unknown) => void = () => undefined;
    gateway.verifyUser.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => (rejectCheck = reject))
    );
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('unavailable'));
    const store = await signIn(createStore());

    store.retry();
    rejectCheck(firebaseError('auth/user-not-found'));
    await flush();

    expect(gateway.signOut).not.toHaveBeenCalled();
    expect(store.status()).toBe('loading');
  });

  it('should sign out when the dogs stay denied after the bounded retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    dogRepo.watchAll.mockImplementation(() => throwError(() => firebaseError('permission-denied')));
    const store = createStore();
    emitUser(ana);
    await vi.advanceTimersByTimeAsync(0);

    households$.next([household]);
    await vi.advanceTimersByTimeAsync(DOGS_RETRY_DELAY_MS * 4);

    expect(gateway.signOut).toHaveBeenCalledTimes(1);
    expect(store.error()).toBe('sessionFailed');
    expect(store.status()).toBe('signedOut');
  });

  it('should reload the session on retry and reach ready', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('unavailable'));
    const store = await signIn(createStore());
    expect(store.status()).toBe('unavailable');

    store.retry();
    await flush();
    households$.next([household]);
    dogs$.next([dela]);
    await flush();

    expect(profiles.ensureProfile).toHaveBeenCalledTimes(2);
    expect(store.status()).toBe('ready');
  });

  it('should retry on its own when the browser comes back online', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    profiles.ensureProfile.mockRejectedValueOnce(firebaseError('unavailable'));
    const store = await signIn(createStore());

    window.dispatchEvent(new Event('online'));
    await flush();

    expect(profiles.ensureProfile).toHaveBeenCalledTimes(2);
    expect(store.status()).toBe('loading');
  });

  it('should ignore going online while the session is healthy', async () => {
    const store = await signIn(createStore());

    window.dispatchEvent(new Event('online'));
    await flush();

    expect(profiles.ensureProfile).toHaveBeenCalledTimes(1);
    expect(store.status()).toBe('loading');
  });

  it('should send a sign-in link to the normalized email and remember it on this device', async () => {
    const store = createStore();

    await store.sendSignInLink('  Ana@Example.com ');

    expect(gateway.sendSignInLink).toHaveBeenCalledWith(
      'ana@example.com',
      `${document.location.origin}/login`
    );
    expect(localStorage.getItem('dela-sign-in-email')).toBe('ana@example.com');
  });

  it('should complete an email-link sign-in with the remembered email', async () => {
    localStorage.setItem('dela-sign-in-email', 'ana@example.com');
    const store = createStore();

    const result = await store.completeSignInLink('https://dela.app/login?oobCode=1');

    expect(result).toBe('signedIn');
    expect(gateway.signInWithLink).toHaveBeenCalledWith(
      'ana@example.com',
      'https://dela.app/login?oobCode=1'
    );
    expect(localStorage.getItem('dela-sign-in-email')).toBeNull();
  });

  it('should ask for the email when the link opens on another device', async () => {
    const store = createStore();

    expect(await store.completeSignInLink('https://dela.app/login?oobCode=1')).toBe('emailNeeded');
    expect(gateway.signInWithLink).not.toHaveBeenCalled();

    await store.completeSignInLink('https://dela.app/login?oobCode=1', ' Ana@Example.com');

    expect(gateway.signInWithLink).toHaveBeenCalledWith(
      'ana@example.com',
      'https://dela.app/login?oobCode=1'
    );
  });

  it('should store the language in the profile of a signed-in user', async () => {
    const store = await signIn(createStore());

    await store.setLocale('es');

    expect(language.setLang).toHaveBeenLastCalledWith('es');
    expect(profiles.setLocale).toHaveBeenCalledWith('ana', 'es');
    expect(store.profile()?.locale).toBe('es');
  });

  it('should only switch the UI language while signed out', async () => {
    const store = createStore();
    emitUser(null);

    await store.setLocale('es');

    expect(language.setLang).toHaveBeenCalledWith('es');
    expect(profiles.setLocale).not.toHaveBeenCalled();
  });
});
