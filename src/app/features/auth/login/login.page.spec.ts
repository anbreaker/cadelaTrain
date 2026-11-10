import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { LoginPageComponent } from './login.page';

describe('LoginPageComponent', () => {
  let session: FakeSession;

  const render = async (): Promise<ComponentFixture<LoginPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [LoginPageComponent, translocoTesting()],
      providers: [provideRouter([]), { provide: AuthSessionStore, useValue: session }],
    });
    const fixture = TestBed.createComponent(LoginPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<LoginPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  const clickGoogle = async (fixture: ComponentFixture<LoginPageComponent>): Promise<void> => {
    element(fixture).querySelector<HTMLButtonElement>('.login__google')?.click();
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
  });

  it('should offer only Google sign-in, without an email form', async () => {
    const fixture = await render();

    expect(element(fixture).querySelector('form')).toBeNull();
    expect(element(fixture).querySelector('input')).toBeNull();
    expect(element(fixture).querySelectorAll('button')).toHaveLength(1);
    expect(element(fixture).querySelector('.login__google')?.textContent).toContain('auth.google');
  });

  it('should sign in with Google (AC1.1)', async () => {
    const fixture = await render();

    await clickGoogle(fixture);

    expect(session.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('should explain when Google sign-in fails', async () => {
    session.signInWithGoogle.mockRejectedValueOnce(new Error('offline'));
    const fixture = await render();

    await clickGoogle(fixture);

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'auth.errors.googleFailed'
    );
  });

  it('should show nothing when the user closes the Google popup', async () => {
    session.signInWithGoogle.mockRejectedValueOnce(
      Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' })
    );
    const fixture = await render();

    await clickGoogle(fixture);

    expect(element(fixture).querySelector('[role="alert"]')).toBeNull();
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
