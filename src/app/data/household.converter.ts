import { isValidEmail, normalizeEmail } from '@domain/email';
import {
  Household,
  HOUSEHOLD_NAME_MAX,
  HouseholdDraft,
  HouseholdMember,
  isLocale,
  Locale,
  LOCALES,
  MemberRole,
  validateHouseholdDraft,
} from '@domain/household';

import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';
import { DISPLAY_NAME_MAX } from './user-profile.converter';

import { DocumentData, FieldValue, serverTimestamp } from 'firebase/firestore';

export const HOUSEHOLD_TIMEZONE = 'Europe/Madrid';
const MEMBER_ROLES: readonly MemberRole[] = ['member', 'owner'];

export type MemberError = 'displayNameRequired';
export type InviteError = 'emailInvalid';
export type InviteResult = 'alreadyInvited' | 'invited';

export interface MemberIdentity {
  displayName: string;
  uid: string;
}

/** Shown to the invitee before joining, since they cannot read the household yet. */
export interface Invitation {
  email: string;
  householdId: string;
  householdName: string;
  invitedBy: string;
}

export interface NewHouseholdData {
  createdAt: FieldValue;
  locale: Locale;
  memberIds: string[];
  members: Record<string, HouseholdMember>;
  name: string;
  ownerId: string;
  timezone: typeof HOUSEHOLD_TIMEZONE;
}

export interface NewInvitation {
  data: {
    createdAt: FieldValue;
    email: string;
    householdName: string;
    invitedBy: string;
  };
  /** Normalized email, also the document id. */
  email: string;
}

export const memberEntry = (displayName: string, role: MemberRole): HouseholdMember => {
  const name = displayName.trim().slice(0, DISPLAY_NAME_MAX).trim();
  if (name.length === 0) throw new ValidationFailedError<MemberError>(['displayNameRequired']);
  return { displayName: name, role };
};

export const newHouseholdData = (
  draft: HouseholdDraft,
  owner: MemberIdentity
): NewHouseholdData => {
  const errors = validateHouseholdDraft(draft);
  // The isLocale check repeats the validator only to narrow the type.
  if (errors.length > 0 || !isLocale(draft.locale)) throw new ValidationFailedError(errors);
  return {
    createdAt: serverTimestamp(),
    locale: draft.locale,
    memberIds: [owner.uid],
    members: { [owner.uid]: memberEntry(owner.displayName, 'owner') },
    name: draft.name.trim(),
    ownerId: owner.uid,
    timezone: HOUSEHOLD_TIMEZONE,
  };
};

export const newInvitationData = (
  email: string,
  householdName: string,
  invitedBy: string
): NewInvitation => {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new ValidationFailedError<InviteError>(['emailInvalid']);
  return {
    data: {
      createdAt: serverTimestamp(),
      email: normalized,
      householdName: householdName.trim().slice(0, HOUSEHOLD_NAME_MAX),
      invitedBy,
    },
    email: normalized,
  };
};

const parseMember = (reader: DocumentReader): HouseholdMember => ({
  displayName: reader.string('displayName'),
  role: reader.oneOf('role', MEMBER_ROLES),
});

export const parseHousehold = (id: string, path: string, data: DocumentData): Household => {
  const reader = new DocumentReader(path, data);
  const members = reader.child('members');
  return {
    id,
    locale: reader.oneOf('locale', LOCALES),
    memberIds: reader.stringArray('memberIds'),
    members: Object.fromEntries(
      members.keys().map((uid) => [uid, parseMember(members.child(uid))])
    ),
    name: reader.string('name'),
    ownerId: reader.string('ownerId'),
    timezone: reader.oneOf('timezone', [HOUSEHOLD_TIMEZONE]),
  };
};

/** Collection-group results carry no household id, so it comes from `households/{hid}/invitations/{email}`. */
export const parseInvitation = (_id: string, path: string, data: DocumentData): Invitation => {
  const [root, householdId, collection] = path.split('/');
  if (root !== 'households' || !householdId || collection !== 'invitations') {
    throw new InvalidDocumentError(path, 'path');
  }
  const reader = new DocumentReader(path, data);
  return {
    email: reader.string('email'),
    householdId,
    householdName: reader.string('householdName'),
    invitedBy: reader.string('invitedBy'),
  };
};

export const householdConverter = readOnlyConverter(parseHousehold);
export const invitationConverter = readOnlyConverter(parseInvitation);
