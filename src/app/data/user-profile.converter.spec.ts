import { InvalidDocumentError } from './data-errors';
import { newUserProfileData, parseUserProfile, profileDisplayName } from './user-profile.converter';

import { serverTimestamp } from 'firebase/firestore';

describe('profileDisplayName', () => {
  it('should use the trimmed auth display name', () => {
    expect(profileDisplayName({ displayName: ' Ana ', email: 'a@x.es', uid: 'u' })).toBe('Ana');
  });

  it('should fall back to the email local part when there is no display name (email link)', () => {
    expect(profileDisplayName({ displayName: null, email: 'jessica@x.es', uid: 'u' })).toBe(
      'jessica'
    );
    expect(profileDisplayName({ displayName: '  ', email: 'jessica@x.es', uid: 'u' })).toBe(
      'jessica'
    );
  });

  it('should cut the name to the 60 characters the rules accept', () => {
    const user = { displayName: 'x'.repeat(70), email: 'a@x.es', uid: 'u' };

    expect(profileDisplayName(user)).toHaveLength(60);
  });
});

describe('newUserProfileData (AC1.1)', () => {
  it('should hold exactly the rule fields, with a lowercased email and a server timestamp', () => {
    const data = newUserProfileData({ displayName: 'Ana', email: ' Ana@X.ES ', uid: 'u' }, 'pt');

    expect(Object.keys(data).sort()).toEqual(['createdAt', 'displayName', 'email', 'locale']);
    expect(data).toMatchObject({ displayName: 'Ana', email: 'ana@x.es', locale: 'pt' });
    expect(data.createdAt.isEqual(serverTimestamp())).toBe(true);
  });
});

describe('parseUserProfile', () => {
  const stored = { createdAt: null, displayName: 'Ana', email: 'ana@x.es', locale: 'es' };

  it('should map a stored profile to the domain type', () => {
    expect(parseUserProfile('u', 'users/u', stored)).toEqual({
      displayName: 'Ana',
      email: 'ana@x.es',
      locale: 'es',
      uid: 'u',
    });
  });

  it('should read a US English locale', () => {
    expect(parseUserProfile('u', 'users/u', { ...stored, locale: 'en' }).locale).toBe('en');
  });

  it('should reject an unsupported locale', () => {
    expect(() => parseUserProfile('u', 'users/u', { ...stored, locale: 'fr' })).toThrow(
      InvalidDocumentError
    );
  });
});
