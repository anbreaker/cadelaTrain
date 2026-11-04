import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
  TokenOptions,
} from '@firebase/rules-unit-testing';

import { doc, DocumentData, Firestore, setDoc, Timestamp } from 'firebase/firestore';

export const HOUSEHOLD_ID = 'h1';
export const DOG_ID = 'd1';
export const DOG_PATH = `households/${HOUSEHOLD_ID}/dogs/${DOG_ID}`;

export interface TestUser {
  displayName: string;
  email: string;
  uid: string;
}

export const OWNER: TestUser = { displayName: 'Alice', email: 'alice@example.com', uid: 'alice' };
export const MEMBER: TestUser = { displayName: 'Bob', email: 'bob@example.com', uid: 'bob' };
export const INVITEE: TestUser = { displayName: 'Carol', email: 'carol@example.com', uid: 'carol' };
export const OUTSIDER: TestUser = { displayName: 'Eve', email: 'eve@example.com', uid: 'eve' };

export async function createRulesEnvironment(): Promise<RulesTestEnvironment> {
  // Host and port come from FIRESTORE_EMULATOR_HOST, set by `firebase emulators:exec`.
  return initializeTestEnvironment({
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    projectId: 'demo-dela',
  });
}

/** The test context returns the compat type; the modular API accepts it, as the app will use. */
function toModular(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

export function dbAs(
  env: RulesTestEnvironment,
  user: TestUser,
  token: Partial<TokenOptions> = {}
): Firestore {
  const claims: TokenOptions = { email: user.email, email_verified: true, ...token };
  return toModular(env.authenticatedContext(user.uid, claims));
}

export async function seed(
  env: RulesTestEnvironment,
  documents: Record<string, DocumentData>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (context: RulesTestContext): Promise<void> => {
    const db = toModular(context);
    for (const [path, data] of Object.entries(documents)) {
      await setDoc(doc(db, path), data);
    }
  });
}

export function householdFixture(): DocumentData {
  return {
    createdAt: Timestamp.now(),
    locale: 'es',
    memberIds: [OWNER.uid, MEMBER.uid],
    members: {
      [MEMBER.uid]: { displayName: MEMBER.displayName, role: 'member' },
      [OWNER.uid]: { displayName: OWNER.displayName, role: 'owner' },
    },
    name: 'Home',
    ownerId: OWNER.uid,
    timezone: 'Europe/Madrid',
  };
}

export function invitationFixture(user: TestUser): DocumentData {
  return {
    createdAt: Timestamp.now(),
    email: user.email,
    householdName: 'Home',
    invitedBy: OWNER.uid,
  };
}

export function dogFixture(): DocumentData {
  return {
    arrivalDate: '2026-12-05',
    birthDate: '2026-10-10',
    breed: 'Labrador',
    createdAt: Timestamp.now(),
    environment: 'rural',
    name: 'Dela',
    planWeek: 1,
    sleepsOutdoors: true,
    updatedAt: Timestamp.now(),
  };
}

/** Household with owner and member, the dog, and a pending invitation for the invitee. */
export async function seedHousehold(env: RulesTestEnvironment): Promise<void> {
  await seed(env, {
    [`households/${HOUSEHOLD_ID}`]: householdFixture(),
    [`households/${HOUSEHOLD_ID}/invitations/${INVITEE.email}`]: invitationFixture(INVITEE),
    [DOG_PATH]: dogFixture(),
  });
}
