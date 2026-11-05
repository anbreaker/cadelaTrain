import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { createRulesEnvironment, dbAs, MEMBER, OWNER, seed, TestUser } from './support';

import { doc, DocumentData, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

function profile(user: TestUser, locale: string): DocumentData {
  return { createdAt: serverTimestamp(), displayName: user.displayName, email: user.email, locale };
}

describe('users rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should let a user write and read their own profile', async () => {
    const db = dbAs(env, OWNER);

    await assertSucceeds(setDoc(doc(db, `users/${OWNER.uid}`), profile(OWNER, 'pt')));
    await assertSucceeds(getDoc(doc(db, `users/${OWNER.uid}`)));
  });

  it("should deny reading or writing another user's profile", async () => {
    await seed(env, {
      [`users/${MEMBER.uid}`]: { ...profile(MEMBER, 'es'), createdAt: new Date() },
    });
    const db = dbAs(env, OWNER);

    await assertFails(getDoc(doc(db, `users/${MEMBER.uid}`)));
    await assertFails(setDoc(doc(db, `users/${MEMBER.uid}`), profile(OWNER, 'es')));
  });

  it('should allow a profile in US English', async () => {
    const db = dbAs(env, OWNER);

    await assertSucceeds(setDoc(doc(db, `users/${OWNER.uid}`), profile(OWNER, 'en')));
  });

  it('should deny a locale other than en, es or pt', async () => {
    const db = dbAs(env, OWNER);

    await assertFails(setDoc(doc(db, `users/${OWNER.uid}`), profile(OWNER, 'fr')));
  });
});
