import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  createRulesEnvironment,
  dbAs,
  HOUSEHOLD_ID,
  householdFixture,
  MEMBER,
  OWNER,
  resetFirestore,
  seed,
  seedHousehold,
  STRANGER,
  TestUser,
} from './support';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const profile = (user: TestUser) => ({
  createdAt: serverTimestamp(),
  displayName: user.displayName,
  email: user.email,
  locale: 'es',
});

const newHousehold = (user: TestUser) => ({
  ...householdFixture(),
  createdAt: serverTimestamp(),
  memberIds: [user.uid],
  members: { [user.uid]: { displayName: user.displayName, role: 'owner' } },
  ownerId: user.uid,
});

describe('access allowlist', () => {
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

  it('should let an allowlisted, verified user create their profile', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, OWNER), `users/${OWNER.uid}`), profile(OWNER)));
  });

  it('should deny a verified user whose email is not allowlisted', async () => {
    const db = dbAs(env, STRANGER);

    await assertFails(setDoc(doc(db, `users/${STRANGER.uid}`), profile(STRANGER)));
    await assertFails(getDoc(doc(db, `users/${STRANGER.uid}`)));
    await assertFails(setDoc(doc(db, 'households/h2'), newHousehold(STRANGER)));
  });

  it('should deny an allowlisted email that is not verified', async () => {
    const db = dbAs(env, OWNER, { email_verified: false });

    await assertFails(setDoc(doc(db, `users/${OWNER.uid}`), profile(OWNER)));
  });

  it('should match the allowlist case-insensitively', async () => {
    const db = dbAs(env, OWNER, { email: 'Alice@Example.com' });

    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER.uid}`), { ...profile(OWNER), email: 'alice@example.com' })
    );
  });

  it('should revoke a member as soon as their email leaves the allowlist', async () => {
    await seedHousehold(env);
    await assertSucceeds(getDoc(doc(dbAs(env, MEMBER), `households/${HOUSEHOLD_ID}`)));

    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`allowedEmails/${MEMBER.email}`).delete();
    });

    await assertFails(getDoc(doc(dbAs(env, MEMBER), `households/${HOUSEHOLD_ID}`)));
  });

  it('should stop a revoked owner from editing the household', async () => {
    await seedHousehold(env);
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`allowedEmails/${OWNER.email}`).delete();
    });

    await assertFails(
      updateDoc(doc(dbAs(env, OWNER), `households/${HOUSEHOLD_ID}`), { name: 'Renamed' })
    );
  });

  describe('allowedEmails documents', () => {
    it('should let anyone signed in read only their own entry, present or not', async () => {
      const own = await assertSucceeds(
        getDoc(doc(dbAs(env, OWNER), `allowedEmails/${OWNER.email}`))
      );
      const missing = await assertSucceeds(
        getDoc(doc(dbAs(env, STRANGER), `allowedEmails/${STRANGER.email}`))
      );

      expect(own.exists()).toBe(true);
      expect(missing.exists()).toBe(false);
    });

    it("should deny reading someone else's entry or listing the collection", async () => {
      const db = dbAs(env, OWNER);

      await assertFails(getDoc(doc(db, `allowedEmails/${MEMBER.email}`)));
      await assertFails(getDocs(collection(db, 'allowedEmails')));
    });

    it('should never let a client write the allowlist', async () => {
      const db = dbAs(env, OWNER);

      await assertFails(setDoc(doc(db, `allowedEmails/${STRANGER.email}`), {}));
      await assertFails(setDoc(doc(db, `allowedEmails/${OWNER.email}`), { note: 'x' }));
      await assertFails(deleteDoc(doc(db, `allowedEmails/${OWNER.email}`)));
    });

    it('should deny reading the allowlist without signing in', async () => {
      const db = env.unauthenticatedContext().firestore();

      await assertFails(db.doc(`allowedEmails/${OWNER.email}`).get());
    });
  });

  it('should keep seeded data readable only through the rules above', async () => {
    await seed(env, { [`users/${STRANGER.uid}`]: { ...profile(STRANGER), createdAt: new Date() } });

    await assertFails(getDoc(doc(dbAs(env, STRANGER), `users/${STRANGER.uid}`)));
  });
});
