const SIGN_IN_EMAIL_KEY = 'dela-sign-in-email';

/**
 * Firebase needs the email again to complete an email-link sign-in. Remembering it on this device
 * lets the same-device flow finish without asking; another device asks for it.
 */
export function rememberSignInEmail(email: string): void {
  try {
    localStorage.setItem(SIGN_IN_EMAIL_KEY, email);
  } catch {
    // Without storage the user is asked for the email when the link opens.
  }
}

export function readSignInEmail(): null | string {
  try {
    return localStorage.getItem(SIGN_IN_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function forgetSignInEmail(): void {
  try {
    localStorage.removeItem(SIGN_IN_EMAIL_KEY);
  } catch {
    // Nothing stored.
  }
}
