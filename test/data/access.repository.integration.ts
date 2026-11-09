import { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { AccessRepository } from '@data/access.repository';

import { createRulesEnvironment, dbAs, OWNER, resetFirestore, STRANGER } from '../rules/support';
import { repositoryFor } from './support';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('AccessRepository (emulator)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should report access for an allowlisted email, whatever its case', async () => {
    const repo = repositoryFor(AccessRepository, dbAs(env, OWNER));

    expect(await repo.hasAccess('Alice@Example.com')).toBe(true);
  });

  it('should report no access, without an error, for any other email', async () => {
    const repo = repositoryFor(AccessRepository, dbAs(env, STRANGER));

    expect(await repo.hasAccess(STRANGER.email)).toBe(false);
  });
});
