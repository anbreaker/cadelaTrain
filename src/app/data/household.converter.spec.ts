import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import {
  memberEntry,
  newHouseholdData,
  newInvitationData,
  parseHousehold,
  parseInvitation,
} from './household.converter';

import { serverTimestamp } from 'firebase/firestore';

const OWNER = { displayName: 'Alice', uid: 'alice' };

const codesOf = (action: () => unknown): readonly string[] => {
  try {
    action();
  } catch (error) {
    if (error instanceof ValidationFailedError) return error.codes;
    throw error;
  }
  throw new Error('expected a ValidationFailedError');
};

describe('newHouseholdData (AC1.2)', () => {
  it('should make the creator the sole owner and member, in Madrid time', () => {
    const data = newHouseholdData({ locale: 'pt', name: ' Finca ' }, OWNER);

    expect(Object.keys(data).sort()).toEqual([
      'createdAt',
      'locale',
      'memberIds',
      'members',
      'name',
      'ownerId',
      'timezone',
    ]);
    expect(data).toMatchObject({
      locale: 'pt',
      memberIds: ['alice'],
      members: { alice: { displayName: 'Alice', role: 'owner' } },
      name: 'Finca',
      ownerId: 'alice',
      timezone: 'Europe/Madrid',
    });
    expect(data.createdAt.isEqual(serverTimestamp())).toBe(true);
  });

  it('should reject an invalid draft with the domain error codes', () => {
    expect(codesOf(() => newHouseholdData({ locale: 'fr', name: ' ' }, OWNER))).toEqual([
      'nameRequired',
      'localeUnsupported',
    ]);
  });
});

describe('memberEntry', () => {
  it('should trim and cut the display name to 60 characters', () => {
    expect(memberEntry(` ${'x'.repeat(70)} `, 'member')).toEqual({
      displayName: 'x'.repeat(60),
      role: 'member',
    });
  });

  it('should require a display name', () => {
    expect(codesOf(() => memberEntry('  ', 'member'))).toEqual(['displayNameRequired']);
  });
});

describe('newInvitationData (AC1.3)', () => {
  it('should key the invitation by the normalized email', () => {
    const invitation = newInvitationData(' Dave@Example.COM ', ' Home ', 'alice');

    expect(invitation.email).toBe('dave@example.com');
    expect(Object.keys(invitation.data).sort()).toEqual([
      'createdAt',
      'email',
      'householdName',
      'invitedBy',
    ]);
    expect(invitation.data).toMatchObject({
      email: 'dave@example.com',
      householdName: 'Home',
      invitedBy: 'alice',
    });
  });

  it('should reject an invalid email before anything is stored', () => {
    expect(codesOf(() => newInvitationData('dave@', 'Home', 'alice'))).toEqual(['emailInvalid']);
  });
});

describe('parseHousehold', () => {
  const stored = {
    createdAt: null,
    locale: 'es',
    memberIds: ['alice', 'bob'],
    members: {
      alice: { displayName: 'Alice', role: 'owner' },
      bob: { displayName: 'Bob', role: 'member' },
    },
    name: 'Home',
    ownerId: 'alice',
    timezone: 'Europe/Madrid',
  };

  it('should map a stored household to the domain type', () => {
    expect(parseHousehold('h1', 'households/h1', stored)).toEqual({
      id: 'h1',
      locale: 'es',
      memberIds: ['alice', 'bob'],
      members: stored.members,
      name: 'Home',
      ownerId: 'alice',
      timezone: 'Europe/Madrid',
    });
  });

  it.each([
    ['an unknown role', { members: { alice: { displayName: 'Alice', role: 'admin' } } }],
    ['another timezone', { timezone: 'Europe/Lisbon' }],
    ['member ids that are not strings', { memberIds: [1] }],
  ])('should reject %s', (_label, change) => {
    expect(() => parseHousehold('h1', 'households/h1', { ...stored, ...change })).toThrow(
      InvalidDocumentError
    );
  });
});

describe('parseInvitation (AC1.4)', () => {
  const stored = {
    createdAt: null,
    email: 'carol@example.com',
    householdName: 'Home',
    invitedBy: 'alice',
  };

  it('should take the household id from the document path', () => {
    expect(
      parseInvitation('carol@example.com', 'households/h1/invitations/carol@example.com', stored)
    ).toEqual({
      email: 'carol@example.com',
      householdId: 'h1',
      householdName: 'Home',
      invitedBy: 'alice',
    });
  });

  it('should reject a document outside a household', () => {
    expect(() => parseInvitation('x', 'invitations/x', stored)).toThrow(InvalidDocumentError);
  });
});
