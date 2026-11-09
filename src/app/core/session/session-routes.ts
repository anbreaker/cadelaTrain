import { filter, map, take } from 'rxjs';
import {
  effect,
  EnvironmentProviders,
  inject,
  provideAppInitializer,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, CanActivateFn, Data, Route, Router } from '@angular/router';

import { AuthSessionStore, SessionStatus } from './auth-session.store';

export type ResolvedStatus = Exclude<SessionStatus, 'loading' | 'unavailable'>;

/** The session is not decided yet, or cannot be loaded right now: nobody is redirected meanwhile. */
const isPending = (status: SessionStatus): status is 'loading' | 'unavailable' =>
  status === 'loading' || status === 'unavailable';

const LANDING: Record<ResolvedStatus, string> = {
  needsDog: '/dog/new',
  needsHousehold: '/household/new',
  ready: '/today',
  signedOut: '/login',
};

const INVITATIONS_PATH = '/invitations';
const SESSION_STATUSES = 'sessionStatuses';

export const landingFor = (status: ResolvedStatus, invitationCount: number): string =>
  status === 'needsHousehold' && invitationCount > 0 ? INVITATIONS_PATH : LANDING[status];

/**
 * `null` means stay: still loading, unavailable (offline: never bounce a signed-in user to sign-in),
 * a route without session rules, or a status the route allows.
 */
export function redirectTarget(
  status: SessionStatus,
  invitationCount: number,
  allowed: readonly ResolvedStatus[] | undefined
): null | string {
  if (isPending(status) || !allowed) return null;

  return allowed.includes(status) ? null : landingFor(status, invitationCount);
}

const allowedStatuses = (data: Data): readonly ResolvedStatus[] | undefined =>
  data[SESSION_STATUSES] as readonly ResolvedStatus[] | undefined;

function guardWith(
  allowedFor: (route: ActivatedRouteSnapshot) => readonly ResolvedStatus[]
): CanActivateFn {
  return (route) => {
    const session = inject(AuthSessionStore);
    const router = inject(Router);

    return toObservable(session.status).pipe(
      filter((status): status is ResolvedStatus => !isPending(status)),
      take(1),
      map((status) => {
        const target = redirectTarget(status, session.invitations().length, allowedFor(route));
        return target ? router.parseUrl(target) : true;
      })
    );
  };
}

/** Lets a route open only for the session statuses it declares in its data (see `sessionRoute`). */
export const sessionGuard: CanActivateFn = guardWith((route) => allowedStatuses(route.data) ?? []);

/** For `''` and unknown paths: always sends the user to the screen of their current status. */
export const landingGuard: CanActivateFn = guardWith(() => []);

export const sessionRoute = (
  statuses: readonly ResolvedStatus[]
): Pick<Route, 'canActivate' | 'data'> => ({
  canActivate: [sessionGuard],
  data: { [SESSION_STATUSES]: statuses },
});

const deepestChild = (snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot =>
  snapshot.firstChild ? deepestChild(snapshot.firstChild) : snapshot;

/**
 * Guards only run on navigation; this moves the user when the status changes on the same screen
 * (signed in from the link, household created, invitation accepted, signed out).
 */
export const provideSessionRedirect = (): EnvironmentProviders =>
  provideAppInitializer(() => {
    const session = inject(AuthSessionStore);
    const router = inject(Router);

    effect(() => {
      const status = session.status();
      const invitationCount = session.invitations().length;

      untracked(() => {
        const route = deepestChild(router.routerState.snapshot.root);
        const target = redirectTarget(status, invitationCount, allowedStatuses(route.data));
        if (target) void router.navigateByUrl(target);
      });
    });
  });
