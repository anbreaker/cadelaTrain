import { normalizeEmail } from '@domain/email';
import { Locale, LOCALES } from '@domain/household';

import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData, FieldValue, serverTimestamp } from 'firebase/firestore';

export const DISPLAY_NAME_MAX = 60;

/** The part of the Firebase Auth user the data layer needs; auth itself is wired in `core`. */
export interface AuthUser {
  displayName: null | string;
  email: string;
  uid: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  locale: Locale;
  uid: string;
}

export interface NewUserProfileData {
  createdAt: FieldValue;
  displayName: string;
  email: string;
  locale: Locale;
}

/** Email-link sign-in has no display name, so the email local part stands in for it. */
export const profileDisplayName = (user: AuthUser): string => {
  const name = user.displayName?.trim() || normalizeEmail(user.email).split('@')[0];
  return name.slice(0, DISPLAY_NAME_MAX).trim();
};

export const newUserProfileData = (user: AuthUser, locale: Locale): NewUserProfileData => ({
  createdAt: serverTimestamp(),
  displayName: profileDisplayName(user),
  email: normalizeEmail(user.email),
  locale,
});

export const parseUserProfile = (uid: string, path: string, data: DocumentData): UserProfile => {
  const reader = new DocumentReader(path, data);
  return {
    displayName: reader.string('displayName'),
    email: reader.string('email'),
    locale: reader.oneOf('locale', LOCALES),
    uid,
  };
};

export const userProfileConverter = readOnlyConverter(parseUserProfile);
