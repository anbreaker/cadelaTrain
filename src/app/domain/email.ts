/** Same pattern as the invitation id check in `firestore.rules`. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Invitations are stored under the lowercased email, so every lookup must normalize first. */
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const isValidEmail = (value: string): boolean => EMAIL.test(value);
