import {
  defer,
  distinctUntilChanged,
  from,
  map,
  Observable,
  retry,
  share,
  Subscription,
  switchMap,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

import { AUTH_GATEWAY } from '@core/auth/auth-gateway';
import { LanguageStore } from '@core/store/language.store';
import { AccessRepository } from '@data/access.repository';
import { DogRepository } from '@data/dog.repository';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { AuthUser, UserProfile } from '@data/user-profile.converter';
import { UserProfileRepository } from '@data/user-profile.repository';
import { Dog } from '@domain/dog';
import { Household, Locale } from '@domain/household';

export type SessionStatus =
  'loading' | 'needsDog' | 'needsHousehold' | 'ready' | 'signedOut' | 'unavailable';

export type SessionError = 'notAllowed' | 'sessionFailed';

/** What depends on the household: its dog, or the invitations of a user who has none yet. */
interface HouseholdDetail {
  dog: Dog | null;
  householdId: null | string;
  invitations: Invitation[];
}

/**
 * Right after creating a household or joining one, the membership query emits the local write
 * before the server has it, and the dogs query is denied until it lands. A few short retries cover
 * that window; a lasting denial still fails the session.
 */
export const DOGS_RETRY_DELAY_MS = 500;
const DOGS_RETRY_COUNT = 3;

/**
 * Without a connection the profile transaction can stay pending; past this limit the session is
 * reported unavailable (still signed in) instead of loading forever.
 */
export const PROFILE_TIMEOUT_MS = 10_000;

/** What a failed session load means: the session is invalid, or the backend is out of reach. */
type FailureKind = 'invalidSession' | 'noAccess' | 'unreachable';

/** The signed-in email is not in the allowlist: the account exists but may not use the app. */
class NoAccessError extends Error {
  readonly code = 'app/no-access';
}

/**
 * Only errors that prove the session itself is no longer valid sign the user out. Anything else
 * (no coverage on the farm, a timeout, an unknown error) keeps the Firebase user and offers a retry,
 * so a bad connection never costs a new sign-in link.
 */
const FAILURE_BY_CODE: Record<string, FailureKind> = {
  'app/no-access': 'noAccess',
  'auth/invalid-refresh-token': 'invalidSession',
  'auth/invalid-user-token': 'invalidSession',
  'auth/user-disabled': 'invalidSession',
  'auth/user-not-found': 'invalidSession',
  'auth/user-token-expired': 'invalidSession',
  'permission-denied': 'invalidSession',
  unauthenticated: 'invalidSession',
};

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

const failureKind = (error: unknown): FailureKind =>
  FAILURE_BY_CODE[errorCode(error)] ?? 'unreachable';

const sameHousehold = (previous: Household | null, next: Household | null): boolean =>
  previous?.id === next?.id;

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageStore);
  private readonly profiles = inject(UserProfileRepository);
  private readonly access = inject(AccessRepository);
  private readonly households = inject(HouseholdRepository);
  private readonly dogs = inject(DogRepository);

  private readonly _detail = signal<HouseholdDetail | undefined>(undefined);
  private readonly _error = signal<null | SessionError>(null);
  /** `undefined` while the membership query has not answered. */
  private readonly _household = signal<Household | null | undefined>(undefined);
  private readonly _profile = signal<null | UserProfile>(null);
  private readonly _unavailable = signal(false);
  /** `undefined` while Firebase has not reported the first auth state. */
  private readonly _user = signal<AuthUser | null | undefined>(undefined);

  private session?: Subscription;

  private readonly failureHandlers: Record<FailureKind, () => void> = {
    invalidSession: () => this.endInvalidSession(),
    noAccess: () => this.endSession('notAllowed'),
    unreachable: () => this.reportUnavailable(),
  };

  readonly user = computed(() => this._user() ?? null);
  readonly profile = this._profile.asReadonly();
  readonly household = computed(() => this._household() ?? null);
  readonly dog = computed(() => this.currentDetail()?.dog ?? null);
  readonly invitations = computed(() => this.currentDetail()?.invitations ?? []);
  readonly error = this._error.asReadonly();
  readonly isOwner = computed(() => {
    const household = this.household();
    return household !== null && household.ownerId === this._user()?.uid;
  });

  readonly status = computed((): SessionStatus => {
    const user = this._user();
    if (user === undefined) return 'loading';
    if (user === null) return 'signedOut';
    if (this._unavailable()) return 'unavailable';

    const household = this._household();
    // A detail of another household is stale: never report "needs a dog" before the dogs load.
    if (!this._profile() || household === undefined || !this.currentDetail()) return 'loading';
    if (household === null) return 'needsHousehold';

    return this.currentDetail()?.dog ? 'ready' : 'needsDog';
  });

  /** The detail only when it belongs to the current household (or to "no household"). */
  private readonly currentDetail = computed((): HouseholdDetail | undefined => {
    const detail = this._detail();
    const householdId = this._household()?.id ?? null;
    return detail?.householdId === householdId ? detail : undefined;
  });

  constructor() {
    this.gateway.onUserChanged((user) => this.applyUser(user));
    // Coverage comes and goes on the farm: retry as soon as the browser is back online.
    this.document.defaultView?.addEventListener('online', () => {
      if (this._unavailable()) this.retry();
    });
  }

  /** Loads the session again for the same signed-in user (the "Retry" button, or back online). */
  retry(): void {
    const user = this._user();
    if (user) this.applyUser(user);
  }

  async signInWithGoogle(): Promise<void> {
    this._error.set(null);
    await this.gateway.signInWithGoogle();
  }

  async signOut(): Promise<void> {
    await this.gateway.signOut();
  }

  /** Switches the UI language now and stores it in `users/{uid}.locale` when signed in. */
  async setLocale(locale: Locale): Promise<void> {
    this.language.setLang(locale);
    const profile = this._profile();
    if (!profile) return;

    this._profile.set({ ...profile, locale });
    await this.profiles.setLocale(profile.uid, locale);
  }

  private applyUser(user: AuthUser | null): void {
    this.session?.unsubscribe();
    this._unavailable.set(false);
    this._profile.set(null);
    this._household.set(undefined);
    this._detail.set(undefined);
    this._user.set(user);
    if (!user) return;

    this.session = this.sessionFor(user).subscribe({
      error: (error: unknown) => this.fail(error),
    });
  }

  private sessionFor(user: AuthUser): Observable<HouseholdDetail> {
    const household$ = this.households.watchForMember(user.uid).pipe(
      map((households) => households[0] ?? null),
      tap((household) => this._household.set(household)),
      share()
    );
    const detail$ = household$.pipe(
      distinctUntilChanged(sameHousehold),
      switchMap((household) =>
        household ? this.dogDetail(household.id) : this.invitationDetail(user.email)
      ),
      tap((detail) => this._detail.set(detail))
    );

    // Access first: an account outside the allowlist never gets a profile.
    return from(this.access.hasAccess(user.email)).pipe(
      switchMap((allowed) =>
        allowed
          ? from(this.profiles.ensureProfile(user, this.language.currentLang()))
          : throwError(() => new NoAccessError())
      ),
      timeout({ first: PROFILE_TIMEOUT_MS }),
      tap((profile) => {
        this._profile.set(profile);
        this.language.setLang(profile.locale);
      }),
      switchMap(() => detail$)
    );
  }

  private dogDetail(householdId: string): Observable<HouseholdDetail> {
    return defer(() => this.dogs.watchAll(householdId)).pipe(
      retry({ count: DOGS_RETRY_COUNT, delay: DOGS_RETRY_DELAY_MS }),
      map((dogs) => ({ dog: dogs[0] ?? null, householdId, invitations: [] }))
    );
  }

  private invitationDetail(email: string): Observable<HouseholdDetail> {
    return from(this.households.pendingInvitationsFor(email)).pipe(
      map((invitations) => ({ dog: null, householdId: null, invitations }))
    );
  }

  private fail(error: unknown): void {
    console.error(error);
    this.failureHandlers[failureKind(error)]();
  }

  /**
   * Shows the "can't reach" notice, then asks the auth server whether the account still exists:
   * a deleted or revoked user (whose profile never loads) is signed out instead of staying stuck.
   * The answer is ignored if the session was reloaded or ended meanwhile.
   */
  private reportUnavailable(): void {
    this._unavailable.set(true);
    const session = this.session;
    this.gateway.verifyUser().catch((error: unknown) => {
      // No `unavailable` check: Firebase `reload` may already have signed the user out.
      if (this.session === session && failureKind(error) === 'invalidSession')
        this.endInvalidSession();
    });
  }

  /** An invalid session is signed out, so the user can sign in again from the sign-in screen. */
  private endInvalidSession(): void {
    this.endSession('sessionFailed');
  }

  /** Signs out and leaves the reason for the sign-in screen. */
  private endSession(reason: SessionError): void {
    this._error.set(reason);
    this._user.set(null);
    void this.gateway.signOut();
  }
}
