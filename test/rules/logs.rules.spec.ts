import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  createRulesEnvironment,
  dbAs,
  DOG_PATH,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seed,
  seedHousehold,
} from './support';

import {
  doc,
  DocumentData,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const NEW_LOG_PATH = `${DOG_PATH}/taskLogs/new`;
const OWNER_LOG_PATH = `${DOG_PATH}/taskLogs/byOwner`;
const OLD_LOG_PATH = `${DOG_PATH}/taskLogs/old`;
const REVIEW_PATH = `${DOG_PATH}/weeklyReviews/1`;

const DAY_MS = 24 * 60 * 60 * 1000;

function trainingLog(doneBy: string, overrides: DocumentData = {}): DocumentData {
  return {
    attempts: 10,
    doneAt: serverTimestamp(),
    doneBy,
    guidanceDate: '2026-12-05',
    kind: 'training',
    notes: '',
    skillKey: 'sit',
    successCount: 7,
    taskId: 't1',
    ...overrides,
  };
}

function socializationLog(doneBy: string, overrides: DocumentData = {}): DocumentData {
  return {
    doneAt: serverTimestamp(),
    doneBy,
    guidanceDate: '2026-12-05',
    kind: 'socialization',
    notes: '',
    reaction: 'curious',
    taskId: 't2',
    ...overrides,
  };
}

describe('taskLogs rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
    await seedHousehold(env);
    await seed(env, {
      [OLD_LOG_PATH]: trainingLog(OWNER.uid, {
        doneAt: Timestamp.fromMillis(Date.now() - DAY_MS - 60_000),
      }),
      [OWNER_LOG_PATH]: trainingLog(OWNER.uid, { doneAt: Timestamp.now() }),
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should let a member log a task as themself at server time', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), trainingLog(MEMBER.uid)));
  });

  it('should deny logging a task as someone else', async () => {
    await assertFails(setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), trainingLog(OWNER.uid)));
  });

  it('should deny a client-chosen doneAt', async () => {
    await assertFails(
      setDoc(
        doc(dbAs(env, MEMBER), NEW_LOG_PATH),
        trainingLog(MEMBER.uid, { doneAt: Timestamp.now() })
      )
    );
  });

  it('should deny a training log without attempts', async () => {
    const log = trainingLog(MEMBER.uid);
    delete log['attempts'];

    await assertFails(setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), log));
  });

  it('should let a member log a search training session', async () => {
    await assertSucceeds(
      setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), trainingLog(MEMBER.uid, { skillKey: 'search' }))
    );
  });

  it('should deny a training log with an unknown skillKey', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), trainingLog(MEMBER.uid, { skillKey: 'attack' }))
    );
  });

  it('should deny a training log without skillKey', async () => {
    const log = trainingLog(MEMBER.uid);
    delete log['skillKey'];

    await assertFails(setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), log));
  });

  it('should deny more successes than attempts', async () => {
    await assertFails(
      setDoc(
        doc(dbAs(env, MEMBER), NEW_LOG_PATH),
        trainingLog(MEMBER.uid, { attempts: 5, successCount: 6 })
      )
    );
  });

  it('should let a member log socialization with a reaction', async () => {
    await assertSucceeds(
      setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), socializationLog(MEMBER.uid))
    );
  });

  it('should deny a socialization log without reaction', async () => {
    const log = socializationLog(MEMBER.uid);
    delete log['reaction'];

    await assertFails(setDoc(doc(dbAs(env, MEMBER), NEW_LOG_PATH), log));
  });

  it('should let the author edit their log within 24 hours', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, OWNER), OWNER_LOG_PATH), { notes: 'Better after a break' })
    );
  });

  it('should deny the author editing their log after 24 hours', async () => {
    await assertFails(updateDoc(doc(dbAs(env, OWNER), OLD_LOG_PATH), { notes: 'Too late' }));
  });

  it("should deny editing another member's log", async () => {
    await assertFails(updateDoc(doc(dbAs(env, MEMBER), OWNER_LOG_PATH), { notes: 'Not mine' }));
  });

  it('should deny a non-member reading or writing logs (AC1.6)', async () => {
    const db = dbAs(env, OUTSIDER);

    await assertFails(getDoc(doc(db, OWNER_LOG_PATH)));
    await assertFails(setDoc(doc(db, NEW_LOG_PATH), trainingLog(OUTSIDER.uid)));
  });
});

describe('weeklyReviews rules', () => {
  let env: RulesTestEnvironment;

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

  function review(updatedBy: string): DocumentData {
    return { notes: 'Good week', updatedAt: serverTimestamp(), updatedBy, weekNumber: 1 };
  }

  it('should let a member write the review as themself', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, MEMBER), REVIEW_PATH), review(MEMBER.uid)));
  });

  it('should deny a review written in the name of someone else', async () => {
    await assertFails(setDoc(doc(dbAs(env, MEMBER), REVIEW_PATH), review(OWNER.uid)));
  });

  it('should deny a non-member writing a review (AC1.6)', async () => {
    await assertFails(setDoc(doc(dbAs(env, OUTSIDER), REVIEW_PATH), review(OUTSIDER.uid)));
  });
});
