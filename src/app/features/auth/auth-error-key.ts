/** `null`: the user cancelled on purpose, so nothing is shown. */
const KEY_BY_CODE: Record<string, null | string> = {
  'auth/cancelled-popup-request': null,
  'auth/popup-closed-by-user': null,
};

const codeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

/** Transloco key for a Firebase Auth failure, or `fallback` when the code has no specific message. */
export function authErrorKey(error: unknown, fallback: string): null | string {
  const code = codeOf(error);
  return code in KEY_BY_CODE ? KEY_BY_CODE[code] : fallback;
}
