import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { computed, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { Invitation } from '@data/household.converter';

import { AuthSessionStore, SessionStatus } from './auth-session.store';
import {
  landingFor,
  landingGuard,
  redirectTarget,
  sessionGuard,
  sessionRoute,
} from './session-routes';

const invitation = { householdId: 'h9' } as Invitation;

describe('landingFor', () => {
  it('should send each resolved status to its screen', () => {
    expect(landingFor('signedOut', 0)).toBe('/login');
    expect(landingFor('needsHousehold', 0)).toBe('/household/new');
    expect(landingFor('needsDog', 0)).toBe('/dog/new');
    expect(landingFor('ready', 0)).toBe('/today');
  });

  it('should show pending invitations to a user without a household', () => {
    expect(landingFor('needsHousehold', 1)).toBe('/invitations');
  });
});

describe('redirectTarget', () => {
  it('should wait while the session is loading', () => {
    expect(redirectTarget('loading', 0, ['ready'])).toBeNull();
  });

  it('should never send an unavailable session to sign-in', () => {
    expect(redirectTarget('unavailable', 0, ['ready'])).toBeNull();
    expect(redirectTarget('unavailable', 0, ['signedOut'])).toBeNull();
  });

  it('should ignore routes that declare no session statuses', () => {
    expect(redirectTarget('signedOut', 0, undefined)).toBeNull();
  });

  it('should stay on a route that allows the status', () => {
    expect(redirectTarget('needsHousehold', 1, ['needsHousehold'])).toBeNull();
  });

  it('should redirect to the landing of the status otherwise', () => {
    expect(redirectTarget('ready', 0, ['signedOut'])).toBe('/today');
    expect(redirectTarget('signedOut', 0, ['ready', 'needsDog'])).toBe('/login');
  });
});

describe('sessionGuard', () => {
  let status: WritableSignal<SessionStatus>;
  let invitations: WritableSignal<Invitation[]>;

  const route = (data: ActivatedRouteSnapshot['data']): ActivatedRouteSnapshot =>
    ({ data }) as ActivatedRouteSnapshot;

  const run = (
    guard: typeof sessionGuard,
    data: ActivatedRouteSnapshot['data']
  ): MaybeAsync<GuardResult> =>
    TestBed.runInInjectionContext(() => guard(route(data), {} as RouterStateSnapshot));

  const resolve = async (result: MaybeAsync<GuardResult>): Promise<GuardResult> =>
    isObservable(result) ? firstValueFrom(result as Observable<GuardResult>) : result;

  const urlOf = (result: GuardResult): string =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : String(result);

  beforeEach(() => {
    status = signal<SessionStatus>('loading');
    invitations = signal<Invitation[]>([]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionStore,
          useValue: { invitations: computed(() => invitations()), status: status.asReadonly() },
        },
      ],
    });
  });

  it('should let an allowed status through', async () => {
    status.set('ready');

    expect(await resolve(run(sessionGuard, sessionRoute(['ready']).data ?? {}))).toBe(true);
  });

  it('should redirect a signed-out visitor to the sign-in screen', async () => {
    status.set('signedOut');

    expect(urlOf(await resolve(run(sessionGuard, sessionRoute(['ready']).data ?? {})))).toBe(
      '/login'
    );
  });

  it('should wait for the session to load before deciding', async () => {
    const pending = resolve(run(sessionGuard, sessionRoute(['needsDog']).data ?? {}));

    invitations.set([invitation]);
    status.set('needsHousehold');
    TestBed.tick();

    expect(urlOf(await pending)).toBe('/invitations');
  });

  it('should hold the navigation while the session is unavailable, then decide', async () => {
    status.set('unavailable');
    const pending = resolve(run(sessionGuard, sessionRoute(['ready']).data ?? {}));
    TestBed.tick();

    status.set('ready');
    TestBed.tick();

    expect(await pending).toBe(true);
  });

  it('should always redirect from the landing route', async () => {
    status.set('needsDog');

    expect(urlOf(await resolve(run(landingGuard, {})))).toBe('/dog/new');
  });
});
