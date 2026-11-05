import { assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { ValidationFailedError } from '@data/data-errors';
import { DogRepository } from '@data/dog.repository';
import { DogDraft } from '@domain/dog';

import {
  createRulesEnvironment,
  dbAs,
  DOG_ID,
  dogFixture,
  HOUSEHOLD_ID,
  householdFixture,
  MEMBER,
  OUTSIDER,
  OWNER,
  seed,
} from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { collection, getDocs } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const TODAY = '2026-11-04';

const DRAFT: DogDraft = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  name: 'Dela',
  notes: '',
  sleepsOutdoors: true,
};

describe('DogRepository on the emulator', () => {
  let env: RulesTestEnvironment;

  const repositoryAs = (user = OWNER): DogRepository =>
    repositoryFor(DogRepository, dbAs(env, user));

  const storedDogCount = async (): Promise<number> => {
    const snapshot = await getDocs(collection(dbAs(env, OWNER), `households/${HOUSEHOLD_ID}/dogs`));
    return snapshot.size;
  };

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, { [`households/${HOUSEHOLD_ID}`]: householdFixture() });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should let the owner register the puppy at plan week 1, visible to members (AC1.5)', async () => {
    const id = await repositoryAs().create(HOUSEHOLD_ID, DRAFT, TODAY);

    const dogs = await firstMatching(
      repositoryAs(MEMBER).watchAll(HOUSEHOLD_ID),
      (list) => list.length > 0
    );

    expect(dogs).toEqual([{ ...DRAFT, id, planWeek: 1 }]);
  });

  it('should reject an invalid draft and store nothing (AC1.5)', async () => {
    const invalid = { ...DRAFT, arrivalDate: '2026-10-01' };

    await expect(repositoryAs().create(HOUSEHOLD_ID, invalid, TODAY)).rejects.toBeInstanceOf(
      ValidationFailedError
    );
    expect(await storedDogCount()).toBe(0);
  });

  it('should let a member update the puppy while keeping planWeek', async () => {
    await seed(env, {
      [`households/${HOUSEHOLD_ID}/dogs/${DOG_ID}`]: { ...dogFixture(), planWeek: 3 },
    });

    await repositoryAs(MEMBER).update(HOUSEHOLD_ID, DOG_ID, { ...DRAFT, name: 'Delita' }, TODAY);

    const [dog] = await firstMatching(
      repositoryAs().watchAll(HOUSEHOLD_ID),
      (list) => list[0]?.name === 'Delita'
    );
    expect(dog).toMatchObject({ id: DOG_ID, name: 'Delita', planWeek: 3 });
  });

  it('should deny a member who is not the owner registering a dog (AC1.5)', async () => {
    await assertFails(repositoryAs(MEMBER).create(HOUSEHOLD_ID, DRAFT, TODAY));
  });

  it('should deny an outsider updating the puppy (AC1.6)', async () => {
    await seed(env, { [`households/${HOUSEHOLD_ID}/dogs/${DOG_ID}`]: dogFixture() });

    await assertFails(repositoryAs(OUTSIDER).update(HOUSEHOLD_ID, DOG_ID, DRAFT, TODAY));
  });
});
