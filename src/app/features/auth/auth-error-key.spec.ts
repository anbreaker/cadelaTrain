import { authErrorKey } from './auth-error-key';

const firebaseError = (code: string): Error & { code: string } =>
  Object.assign(new Error(code), { code });

describe('authErrorKey', () => {
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
