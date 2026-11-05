import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { normalizeEmail } from '@domain/email';
import { Household, HouseholdDraft } from '@domain/household';

import { FIRESTORE } from './firestore.token';
import { validDocs, watchQuery } from './firestore-converter';
import {
  householdConverter,
  Invitation,
  invitationConverter,
  InviteResult,
  memberEntry,
  MemberIdentity,
  newHouseholdData,
  newInvitationData,
} from './household.converter';

import {
  addDoc,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  DocumentReference,
  FieldPath,
  getDocs,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore';

const HOUSEHOLDS = 'households';
const INVITATIONS = 'invitations';

@Injectable({ providedIn: 'root' })
export class HouseholdRepository {
  private readonly db = inject(FIRESTORE);

  /** Validates the draft (throws `ValidationFailedError`) and returns the new household id. */
  async create(draft: HouseholdDraft, owner: MemberIdentity): Promise<string> {
    const data = newHouseholdData(draft, owner);
    const ref = await addDoc(collection(this.db, HOUSEHOLDS), data);
    return ref.id;
  }

  watchForMember(uid: string): Observable<Household[]> {
    const households = collection(this.db, HOUSEHOLDS).withConverter(householdConverter);
    return watchQuery(query(households, where('memberIds', 'array-contains', uid)));
  }

  /**
   * Stores `invitations/{email}`. The rules deny overwriting an invitation, so an existing one is
   * reported as `alreadyInvited` instead of failing.
   */
  async invite(
    householdId: string,
    householdName: string,
    email: string,
    invitedBy: string
  ): Promise<InviteResult> {
    const invitation = newInvitationData(email, householdName, invitedBy);
    const ref = this.invitationRef(householdId, invitation.email);
    return runTransaction(this.db, async (transaction): Promise<InviteResult> => {
      const existing = await transaction.get(ref);
      if (existing.exists()) return 'alreadyInvited';

      transaction.set(ref, invitation.data);
      return 'invited';
    });
  }

  /** Invitations still pending in a household; the rules allow it only for the owner. */
  watchInvitations(householdId: string): Observable<Invitation[]> {
    const invitations = collection(this.db, HOUSEHOLDS, householdId, INVITATIONS).withConverter(
      invitationConverter
    );
    return watchQuery(query(invitations, orderBy('createdAt')));
  }

  async pendingInvitationsFor(email: string): Promise<Invitation[]> {
    const invitations = collectionGroup(this.db, INVITATIONS).withConverter(invitationConverter);
    const snapshot = await getDocs(query(invitations, where('email', '==', normalizeEmail(email))));
    return validDocs(snapshot.docs);
  }

  /** One batch, as the join rule requires: add exactly this user as member and consume the invite. */
  async acceptInvitation(
    householdId: string,
    user: MemberIdentity & { email: string }
  ): Promise<void> {
    const batch = writeBatch(this.db);
    batch.update(
      doc(this.db, HOUSEHOLDS, householdId),
      'memberIds',
      arrayUnion(user.uid),
      new FieldPath('members', user.uid),
      memberEntry(user.displayName, 'member')
    );
    batch.delete(this.invitationRef(householdId, normalizeEmail(user.email)));
    await batch.commit();
  }

  private invitationRef(householdId: string, email: string): DocumentReference {
    return doc(this.db, HOUSEHOLDS, householdId, INVITATIONS, email);
  }
}
