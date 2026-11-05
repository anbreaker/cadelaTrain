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
  timeout,
} from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

import { AUTH_GATEWAY } from '@core/auth/auth-gateway';
import { forgetSignInEmail, readSignInEmail, rememberSignInEmail } from '@core/auth/sign-in-email';
import { LanguageStore } from '@core/store/language.store';
import { DogRepository } from '@data/dog.repository';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { AuthUser, UserProfile } from '@data/user-profile.converter';
import { UserProfileRepository } from '@data/user-profile.repository';
import { Dog } from '@domain/dog';
import { normalizeEmail } from '@domain/email';
import { Household, Locale } from '@domain/household';

export type SessionStatus = 'loading' | 'needsDog' | 'needsHousehold' | 'ready' | 'signedOut';

export type SessionError = 'sessionFailed';

export type SignInLinkResult = 'emailNeeded' | 'signedIn';

/** What depends on the household: its dog, or the invitations of a user who has none yet. */
interface HouseholdDetail {
  dog: Dog | null;
  householdId: null | string;
  invitations: Invitation[];
}

const SIGN_IN_PATH = '/login';

/**
 * Right after creating a household or joining one, the membership query emits the local write
 * before the server has it, and the dogs query is denied until it lands. A few short retries cover
 * that window; a lasting denial still fails the session.
 */
export const DOGS_RETRY_DELAY_MS = 500;
const DOGS_RETRY_COUNT = 3;

/**
 * A stale or revoked session (deleted user, wiped emulator) can leave the profile transaction
 * pending forever; past this limit the session fails and signs out instead of loading forever.
 */
export const PROFILE_TIMEOUT_MS = 10_000;

const sameHousehold = (previous: Household | null, next: Household | null): boolean =>
  previous?.id === next?.id;

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageStore);
  private readonly profiles = inject(UserProfileRepository);
  private readonly households = inject(HouseholdRepository);
  private readonly dogs = inject(DogRepository);

  private readonly _detail = signal<HouseholdDetail | undefined>(undefined);
  private readonly _error = signal<null | SessionError>(null);
  /** `undefined` while the membership query has not answered. */
  private readonly _household = signal<Household | null | undefined>(undefined);
  private readonly _profile = signal<null | UserProfile>(null);
  /** `undefined` while Firebase has not reported the first auth state. */
  private readonly _user = signal<AuthUser | null | undefined>(undefined);

  private session?: Subscription;

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
  }

  async sendSignInLink(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    this._error.set(null);
    await this.gateway.sendSignInLink(normalized, this.signInUrl());
    rememberSignInEmail(normalized);
  }

  /** Link sent to another person (invitation): nothing is remembered on this device. */
  async sendInvitationLink(email: string): Promise<void> {
    await this.gateway.sendSignInLink(normalizeEmail(email), this.signInUrl());
  }

  isSignInLink(url: string): boolean {
    return this.gateway.isSignInLink(url);
  }

  async completeSignInLink(url: string, typedEmail?: string): Promise<SignInLinkResult> {
    const email = typedEmail ? normalizeEmail(typedEmail) : readSignInEmail();
    if (!email) return 'emailNeeded';

    this._error.set(null);
    await this.gateway.signInWithLink(email, url);
    forgetSignInEmail();
    return 'signedIn';
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

    return from(this.profiles.ensureProfile(user, this.language.currentLang())).pipe(
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

  /** A session that cannot load is signed out, so the user can retry from the sign-in screen. */
  private fail(error: unknown): void {
    console.error(error);
    this._error.set('sessionFailed');
    this._user.set(null);
    void this.gateway.signOut();
  }

  private signInUrl(): string {
    return `${this.document.location.origin}${SIGN_IN_PATH}`;
  }
}
