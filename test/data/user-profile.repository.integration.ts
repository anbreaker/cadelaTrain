import { assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { UserProfileRepository } from '@data/user-profile.repository';

import { createRulesEnvironment, dbAs, OUTSIDER, OWNER, resetFirestore } from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const ALICE = { displayName: 'Alice', email: 'Alice@Example.com', uid: OWNER.uid };

describe('UserProfileRepository on the emulator', () => {
  let env: RulesTestEnvironment;

  const repositoryAs = (user = OWNER): UserProfileRepository =>
    repositoryFor(UserProfileRepository, dbAs(env, user));

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should create the profile on first sign-in with a lowercased email (AC1.1)', async () => {
    const repository = repositoryAs();

    const created = await repository.ensureProfile(ALICE, 'es');
    const stored = await firstMatching(repository.watch(OWNER.uid), (profile) => profile !== null);

    const expected = { displayName: 'Alice', email: OWNER.email, locale: 'es', uid: OWNER.uid };
    expect(created).toEqual(expected);
    expect(stored).toEqual(expected);
  });

  it('should leave an existing profile untouched on a later sign-in (AC1.1)', async () => {
    const repository = repositoryAs();
    await repository.ensureProfile(ALICE, 'es');

    const again = await repository.ensureProfile({ ...ALICE, displayName: 'Other' }, 'pt');

    expect(again).toMatchObject({ displayName: 'Alice', locale: 'es' });
  });

  it('should store the chosen UI language (AC1.7)', async () => {
    const repository = repositoryAs();
    await repository.ensureProfile(ALICE, 'es');

    await repository.setLocale(OWNER.uid, 'pt');

    const stored = await firstMatching(
      repository.watch(OWNER.uid),
      (profile) => profile?.locale === 'pt'
    );
    expect(stored?.locale).toBe('pt');
  });

  it("should be denied creating someone else's profile", async () => {
    await assertFails(repositoryAs(OUTSIDER).ensureProfile(ALICE, 'es'));
  });
});
