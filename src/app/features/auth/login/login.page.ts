import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';

import { authErrorKey } from '../auth-error-key';

/** Google is the only way in: the app is private to the family's Google accounts. */
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

  private readonly _errorKey = signal<null | string>(null);
  private readonly _pending = signal(false);

  protected readonly pending = this._pending.asReadonly();
  protected readonly errorKey = computed(() => {
    const sessionError = this.session.error();
    return this._errorKey() ?? (sessionError ? `auth.errors.${sessionError}` : null);
  });

  protected async signInWithGoogle(): Promise<void> {
    if (this._pending()) return;
    this._pending.set(true);
    this._errorKey.set(null);
    try {
      await this.session.signInWithGoogle();
    } catch (error) {
      this._errorKey.set(authErrorKey(error, 'auth.errors.googleFailed'));
    } finally {
      this._pending.set(false);
    }
  }
}
