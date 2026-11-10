import { assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { WeeklyReviewRepository } from '@data/weekly-review.repository';
import { WeeklyReview } from '@domain/weekly-review';

import {
  createRulesEnvironment,
  dbAs,
  DOG_ID,
  DOG_PATH,
  HOUSEHOLD_ID,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seedHousehold,
} from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { collection, getDocs } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const MEASURED_ON = '2026-12-18';

describe('WeeklyReviewRepository on the emulator (AC5.3)', () => {
  let env: RulesTestEnvironment;

  const repositoryAs = (user = MEMBER): WeeklyReviewRepository =>
    repositoryFor(WeeklyReviewRepository, dbAs(env, user));

  const weightLogs = async (): Promise<number[]> =>
    (await getDocs(collection(dbAs(env, OWNER), `${DOG_PATH}/weightLogs`))).docs.map(
      (snapshot) => snapshot.data()['kg'] as number
    );

  const reviewOfWeek = (
    matches: (review: null | WeeklyReview) => boolean,
    user = OWNER
  ): Promise<null | WeeklyReview> =>
    firstMatching(repositoryAs(user).watchWeek(HOUSEHOLD_ID, DOG_ID, 2), matches);

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
    await seedHousehold(env);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should have no review for a week nobody wrote', async () => {
    expect(await reviewOfWeek(() => true)).toBeNull();
  });

  it('should store notes and weight by the editor, and the weight as a weight log', async () => {
    await repositoryAs().save(
      HOUSEHOLD_ID,
      DOG_ID,
      { draft: { notes: 'Buena semana', weightKg: 9.4 }, measuredOn: MEASURED_ON, weekNumber: 2 },
      MEMBER.uid,
      null
    );

    const review = await reviewOfWeek(Boolean);
    expect(review).toMatchObject({
      notes: 'Buena semana',
      updatedBy: MEMBER.uid,
      weekNumber: 2,
      weightKg: 9.4,
    });
    expect(await weightLogs()).toEqual([9.4]);
  });

  it('should let another member edit it and add a weight log only when the weight changes', async () => {
    const save = (
      user: typeof MEMBER,
      notes: string,
      weightKg: null | number,
      previous: null | number
    ): Promise<void> =>
      repositoryAs(user).save(
        HOUSEHOLD_ID,
        DOG_ID,
        { draft: { notes, weightKg }, measuredOn: MEASURED_ON, weekNumber: 2 },
        user.uid,
        previous
      );

    await save(MEMBER, 'Primera nota', 9.4, null);
    await save(OWNER, 'Segunda nota', 9.4, 9.4);
    await save(OWNER, 'Tercera nota', 9.8, 9.4);

    const review = await reviewOfWeek((found) => found?.notes === 'Tercera nota');
    expect(review).toMatchObject({ updatedBy: OWNER.uid, weightKg: 9.8 });
    expect((await weightLogs()).sort()).toEqual([9.4, 9.8]);
  });

  it('should deny an outsider reading or writing the review', async () => {
    await assertFails(
      repositoryAs(OUTSIDER).save(
        HOUSEHOLD_ID,
        DOG_ID,
        { draft: { notes: 'x', weightKg: null }, measuredOn: MEASURED_ON, weekNumber: 2 },
        OUTSIDER.uid,
        null
      )
    );
  });
});
