import { authErrorKey } from './auth-error-key';

const firebaseError = (code: string): Error & { code: string } =>
  Object.assign(new Error(code), { code });

describe('authErrorKey', () => {
  it('should explain an expired or used sign-in link', () => {
    expect(authErrorKey(firebaseError('auth/expired-action-code'), 'auth.errors.googleFailed')).toBe(
      'auth.errors.linkInvalid'
    );
    expect(authErrorKey(firebaseError('auth/invalid-action-code'), 'auth.errors.googleFailed')).toBe(
      'auth.errors.linkInvalid'
    );
  });

  it('should treat an email the provider rejects as invalid', () => {
    expect(authErrorKey(firebaseError('auth/invalid-email'), 'auth.errors.googleFailed')).toBe(
      'auth.errors.emailInvalid'
    );
  });

  it('should show nothing when the user closes the Google window', () => {
    expect(
      authErrorKey(firebaseError('auth/popup-closed-by-user'), 'auth.errors.googleFailed')
    ).toBeNull();
    expect(
      authErrorKey(firebaseError('auth/cancelled-popup-request'), 'auth.errors.googleFailed')
    ).toBeNull();
  });

  it('should fall back to the action message for anything else', () => {
    expect(
      authErrorKey(firebaseError('auth/network-request-failed'), 'auth.errors.googleFailed')
    ).toBe('auth.errors.googleFailed');
    expect(authErrorKey('boom', 'auth.errors.googleFailed')).toBe('auth.errors.googleFailed');
  });
});
