import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  createRulesEnvironment,
  dbAs,
  HOUSEHOLD_ID,
  INVITEE,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seedHousehold,
} from './support';

import {
  collectionGroup,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const INVITATIONS_PATH = `households/${HOUSEHOLD_ID}/invitations`;

function newInvitation(email: string): DocumentData {
  return { createdAt: serverTimestamp(), email, householdName: 'Home', invitedBy: OWNER.uid };
}

describe('invitations rules (AC1.3)', () => {
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

  it('should let the owner invite with the lowercased email as id', async () => {
    const email = 'dave@example.com';

    await assertSucceeds(
      setDoc(doc(dbAs(env, OWNER), `${INVITATIONS_PATH}/${email}`), newInvitation(email))
    );
  });

  it('should deny inviting the same email twice', async () => {
    const db = dbAs(env, OWNER);

    await assertFails(
      setDoc(doc(db, `${INVITATIONS_PATH}/${INVITEE.email}`), newInvitation(INVITEE.email))
    );
  });

  it('should deny a member who is not the owner inviting', async () => {
    const email = 'dave@example.com';

    await assertFails(
      setDoc(doc(dbAs(env, MEMBER), `${INVITATIONS_PATH}/${email}`), newInvitation(email))
    );
  });

  it('should deny an id that is not a valid email', async () => {
    const email = 'not-an-email';

    await assertFails(
      setDoc(doc(dbAs(env, OWNER), `${INVITATIONS_PATH}/${email}`), newInvitation(email))
    );
  });

  it('should deny an id that is not lowercased', async () => {
    const email = 'Dave@Example.com';

    await assertFails(
      setDoc(doc(dbAs(env, OWNER), `${INVITATIONS_PATH}/${email}`), newInvitation(email))
    );
  });

  it('should let the invitee find their invitations with a collection group query', async () => {
    const db = dbAs(env, INVITEE);

    await assertSucceeds(
      getDocs(query(collectionGroup(db, 'invitations'), where('email', '==', INVITEE.email)))
    );
  });

  it("should deny querying someone else's invitations", async () => {
    const db = dbAs(env, OUTSIDER);

    await assertFails(
      getDocs(query(collectionGroup(db, 'invitations'), where('email', '==', INVITEE.email)))
    );
    await assertFails(getDoc(doc(db, `${INVITATIONS_PATH}/${INVITEE.email}`)));
  });

  it('should deny an unverified invitee reading the invitation', async () => {
    const db = dbAs(env, INVITEE, { email_verified: false });

    await assertFails(
      getDocs(query(collectionGroup(db, 'invitations'), where('email', '==', INVITEE.email)))
    );
  });

  it('should let the owner revoke an invitation', async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(env, OWNER), `${INVITATIONS_PATH}/${INVITEE.email}`)));
  });
});
