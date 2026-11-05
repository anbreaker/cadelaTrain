import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  createRulesEnvironment,
  dbAs,
  HOUSEHOLD_ID,
  INVITEE,
  MEMBER,
  OUTSIDER,
  OWNER,
  seedHousehold,
  TestUser,
} from './support';

import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  DocumentData,
  Firestore,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const HOUSEHOLD_PATH = `households/${HOUSEHOLD_ID}`;

function newHousehold(owner: TestUser, memberIds: string[]): DocumentData {
  const members = Object.fromEntries(
    memberIds.map((memberId: string) => [
      memberId,
      { displayName: 'Someone', role: memberId === owner.uid ? 'owner' : 'member' },
    ])
  );
  return {
    createdAt: serverTimestamp(),
    locale: 'pt',
    memberIds,
    members,
    name: 'New home',
    ownerId: owner.uid,
    timezone: 'Europe/Madrid',
  };
}

/** The join batch the app sends: add self as member and consume the invitation. */
function joinBatch(db: Firestore, joiner: TestUser, extra: DocumentData = {}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, HOUSEHOLD_PATH), {
    memberIds: arrayUnion(joiner.uid),
    [`members.${joiner.uid}`]: { displayName: joiner.displayName, role: 'member' },
    ...extra,
  });
  batch.delete(doc(db, `${HOUSEHOLD_PATH}/invitations/${joiner.email}`));
  return batch.commit();
}

describe('households rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seedHousehold(env);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  describe('create', () => {
    it('should let a user create a household as its sole owner', async () => {
      const db = dbAs(env, OUTSIDER);

      await assertSucceeds(
        setDoc(doc(db, 'households/h2'), newHousehold(OUTSIDER, [OUTSIDER.uid]))
      );
    });

    it('should deny creating a household with someone else as member', async () => {
      const db = dbAs(env, OUTSIDER);

      await assertFails(
        setDoc(doc(db, 'households/h2'), newHousehold(OUTSIDER, [OUTSIDER.uid, OWNER.uid]))
      );
    });

    it('should allow a household in US English', async () => {
      const db = dbAs(env, OUTSIDER);

      await assertSucceeds(
        setDoc(doc(db, 'households/h2'), {
          ...newHousehold(OUTSIDER, [OUTSIDER.uid]),
          locale: 'en',
        })
      );
    });

    it('should deny a household locale other than en, es or pt', async () => {
      const db = dbAs(env, OUTSIDER);

      await assertFails(
        setDoc(doc(db, 'households/h2'), {
          ...newHousehold(OUTSIDER, [OUTSIDER.uid]),
          locale: 'fr',
        })
      );
    });

    it('should deny a client-chosen createdAt instead of server time', async () => {
      const db = dbAs(env, OUTSIDER);

      await assertFails(
        setDoc(doc(db, 'households/h2'), {
          ...newHousehold(OUTSIDER, [OUTSIDER.uid]),
          createdAt: new Date('2020-01-01'),
        })
      );
    });
  });

  describe('read', () => {
    it('should let a member read the household', async () => {
      await assertSucceeds(getDoc(doc(dbAs(env, MEMBER), HOUSEHOLD_PATH)));
    });

    it('should deny a non-member reading or writing the household (AC1.6)', async () => {
      const db = dbAs(env, OUTSIDER);

      await assertFails(getDoc(doc(db, HOUSEHOLD_PATH)));
      await assertFails(updateDoc(doc(db, HOUSEHOLD_PATH), { name: 'Mine now' }));
    });
  });

  describe('owner edit', () => {
    it('should let the owner rename the household', async () => {
      await assertSucceeds(updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), { name: 'Farm' }));
    });

    it('should deny the owner changing ownerId', async () => {
      await assertFails(updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), { ownerId: MEMBER.uid }));
    });

    it('should deny a member renaming the household', async () => {
      await assertFails(updateDoc(doc(dbAs(env, MEMBER), HOUSEHOLD_PATH), { name: 'Farm' }));
    });

    it('should let the owner change the guidance language', async () => {
      await assertSucceeds(updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), { locale: 'en' }));
    });

    it('should deny the owner adding a member without an invitation', async () => {
      await assertFails(
        updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), {
          memberIds: arrayUnion(OUTSIDER.uid),
          [`members.${OUTSIDER.uid}`]: { displayName: OUTSIDER.displayName, role: 'member' },
        })
      );
    });

    it('should deny the owner relabelling a member as owner', async () => {
      await assertFails(
        updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), {
          [`members.${MEMBER.uid}.role`]: 'owner',
        })
      );
    });

    it('should deny the owner rewriting an existing member entry', async () => {
      await assertFails(
        updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), {
          [`members.${MEMBER.uid}.displayName`]: 'Renamed',
        })
      );
    });

    it('should let the owner remove a member', async () => {
      await assertSucceeds(
        updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), {
          memberIds: arrayRemove(MEMBER.uid),
          [`members.${MEMBER.uid}`]: deleteField(),
        })
      );
    });

    it('should deny the owner removing themself', async () => {
      await assertFails(
        updateDoc(doc(dbAs(env, OWNER), HOUSEHOLD_PATH), {
          memberIds: arrayRemove(OWNER.uid),
          [`members.${OWNER.uid}`]: deleteField(),
        })
      );
    });
  });

  describe('join via invitation (AC1.4)', () => {
    it('should let a verified invitee add themself and consume the invitation', async () => {
      await assertSucceeds(joinBatch(dbAs(env, INVITEE), INVITEE));
    });

    it('should deny joining without an invitation', async () => {
      await assertFails(joinBatch(dbAs(env, OUTSIDER), OUTSIDER));
    });

    it('should deny joining with an unverified email', async () => {
      await assertFails(joinBatch(dbAs(env, INVITEE, { email_verified: false }), INVITEE));
    });

    it('should deny an invitee adding a different uid', async () => {
      const db = dbAs(env, INVITEE);

      await assertFails(joinBatch(db, { ...INVITEE, uid: OUTSIDER.uid }));
    });

    it('should deny changing other fields while joining', async () => {
      await assertFails(joinBatch(dbAs(env, INVITEE), INVITEE, { name: 'Hijacked' }));
    });

    it('should deny joining as owner', async () => {
      const db = dbAs(env, INVITEE);

      await assertFails(
        updateDoc(doc(db, HOUSEHOLD_PATH), {
          memberIds: arrayUnion(INVITEE.uid),
          [`members.${INVITEE.uid}`]: { displayName: INVITEE.displayName, role: 'owner' },
        })
      );
    });
  });
});
