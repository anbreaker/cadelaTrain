import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AppUpdateStore } from '@core/pwa/app-update.store';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { ThemeStore } from '@core/store/theme.store';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { AppComponent } from './app';

describe('AppComponent', () => {
  let updateReady: WritableSignal<boolean>;
  let applyUpdate: ReturnType<typeof vi.fn>;
  let session: FakeSession;
  let theme: { isDark: WritableSignal<boolean>; toggle: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    updateReady = signal(false);
    applyUpdate = vi.fn(async () => undefined);
    session = createFakeSession();
    theme = { isDark: signal(true), toggle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AppComponent, translocoTesting()],
      providers: [
        provideRouter([
          { children: [], path: 'today' },
          { children: [], path: 'household' },
          { children: [], path: 'login' },
        ]),
        {
          provide: AppUpdateStore,
          useValue: { applyUpdate, updateReady: updateReady.asReadonly() },
        },
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        { provide: ThemeStore, useValue: theme },
      ],
    }).compileComponents();
  });

  const render = async (): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const navLinks = (element: HTMLElement): (null | string)[] =>
    Array.from(element.querySelectorAll('.site-header__link')).map((link) =>
      link.getAttribute('href')
    );

  it('should render the site header above the router outlet on every screen', async () => {
    const compiled = await render();

    expect(compiled.querySelector('app-site-header + router-outlet')).not.toBeNull();
  });

  it('should show no navigation and no sign out to a visitor', async () => {
    session.set.status.set('signedOut');
    const compiled = await render();

    expect(navLinks(compiled)).toEqual([]);
    expect(compiled.querySelector('.site-header__sign-out')).toBeNull();
  });

  it('should show the app sections and sign out once the household has its puppy', async () => {
    session.set.status.set('ready');
    session.set.profile.set({
      displayName: 'Ana',
      email: 'ana@example.com',
      locale: 'es',
      uid: 'ana',
    });
    const compiled = await render();

    expect(navLinks(compiled)).toEqual(['/today', '/progress', '/rules', '/household']);

    compiled.querySelector<HTMLButtonElement>('.site-header__sign-out')?.click();

    expect(session.signOut).toHaveBeenCalledTimes(1);
  });

  it('should only offer sign out during onboarding', async () => {
    session.set.status.set('needsDog');
    session.set.profile.set({
      displayName: 'Ana',
      email: 'ana@example.com',
      locale: 'es',
      uid: 'ana',
    });
    const compiled = await render();

    expect(navLinks(compiled)).toEqual([]);
    expect(compiled.querySelector('.site-header__sign-out')).not.toBeNull();
  });

  it('should store the chosen language and reveal the theme from the click point (AC1.7)', async () => {
    session.set.status.set('signedOut');
    const compiled = await render();

    compiled.querySelector<HTMLButtonElement>('button[aria-label="Português"]')?.click();
    compiled
      .querySelector('.theme-toggle')
      ?.dispatchEvent(new MouseEvent('click', { clientX: 12, clientY: 34, detail: 1 }));

    expect(session.setLocale).toHaveBeenCalledWith('pt');
    expect(theme.toggle).toHaveBeenCalledWith({ x: 12, y: 34 });
  });

  it('should cover the screen while the session is loading', async () => {
    session.set.status.set('loading');
    const compiled = await render();

    expect(compiled.querySelector('.app-loading')?.getAttribute('role')).toBe('status');
  });

  it('should show visible loading text and a progress indicator while loading', async () => {
    session.set.status.set('loading');
    const compiled = await render();

    expect(compiled.querySelector('.app-loading__text')?.textContent?.trim()).toBe('shell.loading');
    expect(compiled.querySelector('.app-loading__text')?.classList).not.toContain(
      'visually-hidden'
    );
    expect(compiled.querySelector('.app-loading__indicator')).not.toBeNull();
  });

  /** Starts a navigation and reads the loading text while it is still pending. */
  const loadingTextDuring = async (
    fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>,
    url: string
  ): Promise<string | undefined> => {
    const navigation = TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.querySelector('.app-loading__text')?.textContent?.trim();
    await navigation;
    return text;
  };

  it('should say it is signing in from a sign-in link until the user leaves the sign-in screen', async () => {
    session.isSignInLink.mockReturnValue(true);
    session.set.status.set('needsHousehold');
    // The app starts on the sign-in screen the email link points to.
    history.replaceState(null, '', '/login');
    const fixture = TestBed.createComponent(AppComponent);
    history.replaceState(null, '', '/');

    expect(await loadingTextDuring(fixture, '/login')).toBe('auth.signingIn');
    expect(await loadingTextDuring(fixture, '/today')).toBe('auth.signingIn');
    expect(await loadingTextDuring(fixture, '/household')).toBe('shell.loading');
  });

  it('should keep the plain loading text when not opened from a sign-in link', async () => {
    session.set.status.set('needsHousehold');
    const fixture = TestBed.createComponent(AppComponent);

    expect(await loadingTextDuring(fixture, '/login')).toBe('shell.loading');
  });

  it('should keep a signed-in user in place with a calm retry screen when the data is unreachable', async () => {
    session.set.status.set('unavailable');
    session.set.profile.set({
      displayName: 'Ana',
      email: 'ana@example.com',
      locale: 'es',
      uid: 'ana',
    });
    const compiled = await render();
    const state = compiled.querySelector('.unavailable-state');

    expect(state?.getAttribute('role')).toBe('status');
    expect(state?.querySelector('h1')?.textContent).toContain('shell.unavailableTitle');
    expect(compiled.querySelector('.app-loading')).toBeNull();

    state?.querySelector<HTMLButtonElement>('button')?.click();

    expect(session.retry).toHaveBeenCalledTimes(1);
    expect(session.signOut).not.toHaveBeenCalled();
  });

  it('should not cover the screen once the session is known and navigation settled', async () => {
    session.set.status.set('signedOut');
    const compiled = await render();

    expect(compiled.querySelector('.app-loading')).toBeNull();
  });

  it('should show the update banner when a new version is ready and apply it on reload', async () => {
    updateReady.set(true);
    const compiled = await render();

    const banner = compiled.querySelector('.update-banner');
    const button = banner?.querySelector<HTMLButtonElement>('.update-banner__button');

    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.querySelector('.update-banner__text')?.textContent?.trim()).toBe(
      'pwa.updateReady'
    );

    button?.click();

    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });
});
