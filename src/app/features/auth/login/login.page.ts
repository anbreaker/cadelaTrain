import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { EMULATOR_SIGN_IN } from '@core/auth/emulator-sign-in-link';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { isValidEmail, normalizeEmail } from '@domain/email';
import { eventValue } from '@shared/utils/event-value';

import { authErrorKey } from '../auth-error-key';

/** `confirmEmail`: the link was opened on a device that does not remember the email. */
type LoginView = 'confirmEmail' | 'form' | 'sent' | 'signingIn';

const SESSION_ERROR_KEY = 'auth.errors.sessionFailed';
const EMULATOR_LINK_MISSING_KEY = 'auth.errors.emulatorLinkMissing';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-login-page',
  styleUrl: './login.page.css',
  templateUrl: './login.page.html',
})
export class LoginPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly document = inject(DOCUMENT);
  private readonly emulatorSignIn = inject(EMULATOR_SIGN_IN);

  private readonly _email = signal('');
  private readonly _errorKey = signal<null | string>(null);
  private readonly _pending = signal(false);
  private readonly _submitted = signal(false);
  private readonly _view = signal<LoginView>('form');

  protected readonly view = this._view.asReadonly();
  protected readonly email = this._email.asReadonly();
  protected readonly pending = this._pending.asReadonly();
  protected readonly emailInvalid = computed(
    () => this._submitted() && !isValidEmail(normalizeEmail(this._email()))
  );
  protected readonly errorKey = computed(
    () => this._errorKey() ?? (this.session.error() ? SESSION_ERROR_KEY : null)
  );
  protected readonly sentTo = computed(() => normalizeEmail(this._email()));
  protected readonly offersEmulatorLink = this.emulatorSignIn !== null;

  constructor() {
    const url = this.document.location.href;
    if (this.session.isSignInLink(url)) void this.completeLink(url);
  }

  protected setEmail(event: Event): void {
    this._email.set(eventValue(event));
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this._submitted.set(true);
    if (this.emailInvalid() || this._pending()) return;

    const confirming = this._view() === 'confirmEmail';
    return confirming
      ? this.completeLink(this.document.location.href, this.sentTo())
      : this.sendLink();
  }

  protected async signInWithGoogle(): Promise<void> {
    this._errorKey.set(null);
    try {
      await this.session.signInWithGoogle();
    } catch (error) {
      this._errorKey.set(authErrorKey(error, 'auth.errors.googleFailed'));
    }
  }

  /** Development with the Auth emulator: open the link it holds instead of hunting for it in logs. */
  protected async openEmulatorLink(): Promise<void> {
    const emulator = this.emulatorSignIn;
    if (!emulator) return;

    await this.run(async () => {
      const opened = await emulator.openLatest(this.sentTo());
      if (!opened) this._errorKey.set(EMULATOR_LINK_MISSING_KEY);
    }, EMULATOR_LINK_MISSING_KEY);
  }

  protected useAnotherEmail(): void {
    this._submitted.set(false);
    this._view.set('form');
  }

  private async sendLink(): Promise<void> {
    await this.run(async () => {
      await this.session.sendSignInLink(this.sentTo());
      this._view.set('sent');
    }, 'auth.errors.sendFailed');
  }

  private async completeLink(url: string, email?: string): Promise<void> {
    this._view.set('signingIn');
    await this.run(async () => {
      const result = await (email
        ? this.session.completeSignInLink(url, email)
        : this.session.completeSignInLink(url));
      // On success the session redirect leaves this page; only the other-device case stays.
      if (result === 'emailNeeded') this._view.set('confirmEmail');
    }, 'auth.errors.linkInvalid');
    if (this._errorKey()) this._view.set('form');
  }

  private async run(action: () => Promise<void>, fallbackKey: string): Promise<void> {
    this._pending.set(true);
    this._errorKey.set(null);
    try {
      await action();
    } catch (error) {
      this._errorKey.set(authErrorKey(error, fallbackKey));
    } finally {
      this._pending.set(false);
    }
  }
}
