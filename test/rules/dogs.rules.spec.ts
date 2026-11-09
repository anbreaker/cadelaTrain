import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  createRulesEnvironment,
  dbAs,
  DOG_PATH,
  HOUSEHOLD_ID,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seed,
  seedHousehold,
} from './support';

import { doc, DocumentData, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const NEW_DOG_PATH = `households/${HOUSEHOLD_ID}/dogs/d2`;
const GUIDANCE_PATH = `${DOG_PATH}/dailyGuidance/2026-12-05`;

function newDog(overrides: DocumentData = {}): DocumentData {
  return {
    arrivalDate: '2026-12-05',
    birthDate: '2026-10-10',
    createdAt: serverTimestamp(),
    environment: 'urban',
    name: 'Luna',
    planWeek: 1,
    sleepsOutdoors: false,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('dogs rules (AC1.5)', () => {
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

  it('should let the owner register a dog at plan week 1', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, OWNER), NEW_DOG_PATH), newDog()));
  });

  it('should deny registering a dog at another plan week', async () => {
    await assertFails(setDoc(doc(dbAs(env, OWNER), NEW_DOG_PATH), newDog({ planWeek: 3 })));
  });

  it('should deny a member registering a dog', async () => {
    await assertFails(setDoc(doc(dbAs(env, MEMBER), NEW_DOG_PATH), newDog()));
  });

  it('should deny an arrival date earlier than the birth date', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, OWNER), NEW_DOG_PATH), newDog({ arrivalDate: '2026-10-01' }))
    );
  });

  it('should let a member update the dog', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, MEMBER), DOG_PATH), {
        notes: 'Loves the barn',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('should deny a client changing planWeek', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, MEMBER), DOG_PATH), { planWeek: 2, updatedAt: serverTimestamp() })
    );
  });

  it('should let a member read the dog', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, MEMBER), DOG_PATH)));
  });

  it('should deny a non-member reading or writing the dog (AC1.6)', async () => {
    const db = dbAs(env, OUTSIDER);

    await assertFails(getDoc(doc(db, DOG_PATH)));
    await assertFails(
      updateDoc(doc(db, DOG_PATH), { name: 'Stolen', updatedAt: serverTimestamp() })
    );
  });

  describe('dailyGuidance', () => {
    beforeEach(async () => {
      await seed(env, { [GUIDANCE_PATH]: { date: '2026-12-05', summary: 'First day' } });
    });

    it('should let a member read guidance', async () => {
      await assertSucceeds(getDoc(doc(dbAs(env, MEMBER), GUIDANCE_PATH)));
    });

    it('should deny any client writing guidance, even the owner', async () => {
      const db = dbAs(env, OWNER);

      await assertFails(updateDoc(doc(db, GUIDANCE_PATH), { summary: 'Edited' }));
      await assertFails(setDoc(doc(db, `${DOG_PATH}/dailyGuidance/2026-12-06`), { date: 'x' }));
    });

    it('should deny a non-member reading guidance (AC1.6)', async () => {
      await assertFails(getDoc(doc(dbAs(env, OUTSIDER), GUIDANCE_PATH)));
    });
  });
});
