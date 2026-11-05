import { firstValueFrom } from 'rxjs';
import { assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { ValidationFailedError } from '@data/data-errors';
import { HouseholdRepository } from '@data/household.repository';

import {
  createRulesEnvironment,
  dbAs,
  HOUSEHOLD_ID,
  INVITEE,
  MEMBER,
  OUTSIDER,
  OWNER,
  seedHousehold,
} from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { collection, getDocs } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const INVITATIONS_PATH = `households/${HOUSEHOLD_ID}/invitations`;

describe('HouseholdRepository on the emulator', () => {
  let env: RulesTestEnvironment;

  const repositoryAs = (user = OWNER): HouseholdRepository =>
    repositoryFor(HouseholdRepository, dbAs(env, user));

  const storedInvitationIds = async (): Promise<string[]> => {
    const snapshot = await getDocs(collection(dbAs(env, OWNER), INVITATIONS_PATH));
    return snapshot.docs.map((invitation) => invitation.id).sort();
  };

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should create a household with the creator as owner and find it by member (AC1.2)', async () => {
    const repository = repositoryAs(OUTSIDER);

    const id = await repository.create({ locale: 'pt', name: ' Finca ' }, OUTSIDER);
    const [household] = await firstMatching(
      repository.watchForMember(OUTSIDER.uid),
      (households) => households.length > 0
    );

    expect(household).toEqual({
      id,
      locale: 'pt',
      memberIds: [OUTSIDER.uid],
      members: { [OUTSIDER.uid]: { displayName: OUTSIDER.displayName, role: 'owner' } },
      name: 'Finca',
      ownerId: OUTSIDER.uid,
      timezone: 'Europe/Madrid',
    });
  });

  describe('with a seeded household', () => {
    beforeEach(async () => {
      await seedHousehold(env);
    });

    it('should invite by normalized email and not duplicate a second invite (AC1.3)', async () => {
      const repository = repositoryAs();

      const first = await repository.invite(HOUSEHOLD_ID, 'Home', ' Dave@Example.com ', OWNER.uid);
      const second = await repository.invite(HOUSEHOLD_ID, 'Home', 'dave@example.com', OWNER.uid);

      expect([first, second]).toEqual(['invited', 'alreadyInvited']);
      expect(await storedInvitationIds()).toEqual([INVITEE.email, 'dave@example.com'].sort());
    });

    it('should reject an invalid email and store nothing (AC1.3)', async () => {
      await expect(
        repositoryAs().invite(HOUSEHOLD_ID, 'Home', 'dave@', OWNER.uid)
      ).rejects.toBeInstanceOf(ValidationFailedError);
      expect(await storedInvitationIds()).toEqual([INVITEE.email]);
    });

    it('should be denied when a member who is not the owner invites (AC1.3)', async () => {
      await assertFails(
        repositoryAs(MEMBER).invite(HOUSEHOLD_ID, 'Home', 'dave@example.com', MEMBER.uid)
      );
    });

    it('should let the owner watch the pending invitations of the household (AC1.3)', async () => {
      const repository = repositoryAs();
      await repository.invite(HOUSEHOLD_ID, 'Home', 'dave@example.com', OWNER.uid);

      const invitations = await firstMatching(
        repository.watchInvitations(HOUSEHOLD_ID),
        (pending) => pending.length === 2
      );

      expect(invitations.map((invitation) => invitation.email).sort()).toEqual(
        [INVITEE.email, 'dave@example.com'].sort()
      );
    });

    it('should deny a member who is not the owner from watching the invitations (AC1.3)', async () => {
      await expect(
        firstValueFrom(repositoryAs(MEMBER).watchInvitations(HOUSEHOLD_ID))
      ).rejects.toThrow();
    });

    it('should list the pending invitations of the signed-in email (AC1.4)', async () => {
      const invitations = await repositoryAs(INVITEE).pendingInvitationsFor(' CAROL@example.com');

      expect(invitations).toEqual([
        {
          email: INVITEE.email,
          householdId: HOUSEHOLD_ID,
          householdName: 'Home',
          invitedBy: OWNER.uid,
        },
      ]);
    });

    it('should join the invitee as member and consume the invitation in one batch (AC1.4)', async () => {
      const repository = repositoryAs(INVITEE);

      await repository.acceptInvitation(HOUSEHOLD_ID, INVITEE);

      const [household] = await firstMatching(
        repository.watchForMember(INVITEE.uid),
        (households) => households.length > 0
      );
      expect(household.memberIds).toEqual([OWNER.uid, MEMBER.uid, INVITEE.uid]);
      expect(household.members[INVITEE.uid]).toEqual({
        displayName: INVITEE.displayName,
        role: 'member',
      });
      expect(await storedInvitationIds()).toEqual([]);
    });

    it('should deny joining without an invitation for the signed-in email (AC1.4)', async () => {
      await assertFails(repositoryAs(OUTSIDER).acceptInvitation(HOUSEHOLD_ID, OUTSIDER));
    });
  });
});
