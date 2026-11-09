import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EMULATOR_SIGN_IN, EmulatorSignIn } from '@core/auth/emulator-sign-in-link';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { LoginPageComponent } from './login.page';

describe('LoginPageComponent', () => {
  let session: FakeSession;

  let emulatorSignIn: EmulatorSignIn | null;

  const render = async (): Promise<ComponentFixture<LoginPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [LoginPageComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AuthSessionStore, useValue: session },
        { provide: EMULATOR_SIGN_IN, useValue: emulatorSignIn },
      ],
    });
    const fixture = TestBed.createComponent(LoginPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<LoginPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  const submitEmail = async (
    fixture: ComponentFixture<LoginPageComponent>,
    email: string
  ): Promise<void> => {
    const input = element(fixture).querySelector<HTMLInputElement>('input[type="email"]');
    if (!input) throw new Error('email input missing');
    input.value = email;
    input.dispatchEvent(new Event('input'));
    element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    emulatorSignIn = null;
  });

  describe('with the Auth emulator', () => {
    const emulatorButton = (
      fixture: ComponentFixture<LoginPageComponent>
    ): HTMLButtonElement | null =>
      element(fixture).querySelector<HTMLButtonElement>('.login__emulator-link');

    it('should offer to open the emulator link after sending it', async () => {
      emulatorSignIn = { openLatest: vi.fn(async () => true) };
      const fixture = await render();
      await submitEmail(fixture, 'ana@example.com');

      emulatorButton(fixture)?.click();
      await fixture.whenStable();

      expect(emulatorButton(fixture)?.textContent).toContain('auth.openEmulatorLink');
      expect(emulatorSignIn.openLatest).toHaveBeenCalledWith('ana@example.com');
    });

    it('should explain when the emulator has no link for that email', async () => {
      emulatorSignIn = { openLatest: vi.fn(async () => false) };
      const fixture = await render();
      await submitEmail(fixture, 'ana@example.com');

      emulatorButton(fixture)?.click();
      await fixture.whenStable();

      expect(element(fixture).textContent).toContain('auth.errors.emulatorLinkMissing');
    });

    it('should not offer the emulator link outside the emulators', async () => {
      const fixture = await render();
      await submitEmail(fixture, 'ana@example.com');

      expect(emulatorButton(fixture)).toBeNull();
    });
  });

  it('should reject an invalid email without sending anything', async () => {
    const fixture = await render();

    await submitEmail(fixture, 'not-an-email');

    expect(session.sendSignInLink).not.toHaveBeenCalled();
    expect(element(fixture).querySelector('.field__error')?.textContent).toContain(
      'auth.errors.emailInvalid'
    );
    expect(element(fixture).querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('should send the link and show the check-your-email state (AC1.1)', async () => {
    const fixture = await render();

    await submitEmail(fixture, ' ana@example.com ');

    expect(session.sendSignInLink).toHaveBeenCalledWith('ana@example.com');
    expect(element(fixture).querySelector('h1')?.textContent).toContain('auth.checkEmailTitle');
  });

  it('should explain when the link cannot be sent', async () => {
    session.sendSignInLink.mockRejectedValueOnce(new Error('offline'));
    const fixture = await render();

    await submitEmail(fixture, 'ana@example.com');

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'auth.errors.sendFailed'
    );
  });

  it('should offer Google sign-in (AC1.1)', async () => {
    const fixture = await render();

    element(fixture).querySelector<HTMLButtonElement>('.login__google')?.click();
    await fixture.whenStable();

    expect(session.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('should complete an email-link sign-in opened on this device', async () => {
    session.isSignInLink.mockReturnValue(true);

    await render();

    expect(session.completeSignInLink).toHaveBeenCalledWith(document.location.href);
  });

  it('should ask for the email when the link was opened on another device', async () => {
    session.isSignInLink.mockReturnValue(true);
    session.completeSignInLink.mockResolvedValueOnce('emailNeeded');
    const fixture = await render();

    expect(element(fixture).querySelector('h1')?.textContent).toContain('auth.confirmEmailTitle');

    await submitEmail(fixture, 'ana@example.com');

    expect(session.completeSignInLink).toHaveBeenLastCalledWith(
      document.location.href,
      'ana@example.com'
    );
  });

  it('should explain an expired link', async () => {
    session.isSignInLink.mockReturnValue(true);
    session.completeSignInLink.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { code: 'auth/expired-action-code' })
    );
    const fixture = await render();

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'auth.errors.linkInvalid'
    );
  });

  it('should show why the previous session was closed', async () => {
    session.set.error.set('sessionFailed');
    const fixture = await render();

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'auth.errors.sessionFailed'
    );
  });

  it('should say the account has no access when it is not allowlisted', async () => {
    session.set.error.set('notAllowed');
    const fixture = await render();

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'auth.errors.notAllowed'
    );
  });

  it('should leave language and theme to the site header', async () => {
    const fixture = await render();

    expect(element(fixture).querySelector('app-lang-selector')).toBeNull();
    expect(element(fixture).querySelector('app-theme-toggle')).toBeNull();
  });
});
