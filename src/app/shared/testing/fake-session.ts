import { computed, Signal, signal, WritableSignal } from '@angular/core';

import { SessionError, SessionStatus } from '@core/session/auth-session.store';
import { Invitation } from '@data/household.converter';
import { AuthUser, UserProfile } from '@data/user-profile.converter';
import { Dog } from '@domain/dog';
import { Household } from '@domain/household';

import { vi } from 'vitest';

type Spy = ReturnType<typeof vi.fn>;

/** Writable stand-in for `AuthSessionStore`: tests set the signals and spy on the intents. */
export interface FakeSession {
  dog: Signal<Dog | null>;
  error: Signal<null | SessionError>;
  household: Signal<Household | null>;
  invitations: Signal<Invitation[]>;
  isOwner: Signal<boolean>;
  profile: Signal<null | UserProfile>;
  retry: Spy;
  set: {
    dog: WritableSignal<Dog | null>;
    error: WritableSignal<null | SessionError>;
    household: WritableSignal<Household | null>;
    invitations: WritableSignal<Invitation[]>;
    isOwner: WritableSignal<boolean>;
    profile: WritableSignal<null | UserProfile>;
    status: WritableSignal<SessionStatus>;
  };
  setLocale: Spy;
  signInWithGoogle: Spy;
  signOut: Spy;
  status: Signal<SessionStatus>;
  user: Signal<AuthUser | null>;
}

export function createFakeSession(): FakeSession {
  const status = signal<SessionStatus>('signedOut');
  const profile = signal<null | UserProfile>(null);
  const household = signal<Household | null>(null);
  const dog = signal<Dog | null>(null);
  const invitations = signal<Invitation[]>([]);
  const error = signal<null | SessionError>(null);
  const isOwner = signal(true);

  return {
    dog: dog.asReadonly(),
    error: error.asReadonly(),
    household: household.asReadonly(),
    invitations: invitations.asReadonly(),
    isOwner: isOwner.asReadonly(),
    profile: profile.asReadonly(),
    retry: vi.fn(),
    set: { dog, error, household, invitations, isOwner, profile, status },
    setLocale: vi.fn(async () => undefined),
    signInWithGoogle: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    status: status.asReadonly(),
    user: computed((): AuthUser | null => {
      const current = profile();
      return current
        ? { displayName: current.displayName, email: current.email, uid: current.uid }
        : null;
    }),
  };
}
