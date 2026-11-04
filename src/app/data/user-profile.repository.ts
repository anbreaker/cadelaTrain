import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { Locale } from '@domain/household';

import { FIRESTORE } from './firestore.token';
import { watchDocument } from './firestore-converter';
import {
  AuthUser,
  newUserProfileData,
  UserProfile,
  userProfileConverter,
} from './user-profile.converter';

import { doc, DocumentReference, runTransaction, updateDoc } from 'firebase/firestore';

const USERS = 'users';

@Injectable({ providedIn: 'root' })
export class UserProfileRepository {
  private readonly db = inject(FIRESTORE);

  /** Creates `users/{uid}` on first sign-in; an existing profile (and its locale) stays untouched. */
  async ensureProfile(user: AuthUser, locale: Locale): Promise<UserProfile> {
    const ref = this.profileRef(user.uid);
    return runTransaction(this.db, async (transaction): Promise<UserProfile> => {
      const existing = await transaction.get(ref.withConverter(userProfileConverter));
      if (existing.exists()) return existing.data();

      const data = newUserProfileData(user, locale);
      transaction.set(ref, data);
      return { displayName: data.displayName, email: data.email, locale, uid: user.uid };
    });
  }

  async setLocale(uid: string, locale: Locale): Promise<void> {
    await updateDoc(this.profileRef(uid), { locale });
  }

  watch(uid: string): Observable<null | UserProfile> {
    return watchDocument(this.profileRef(uid).withConverter(userProfileConverter));
  }

  private profileRef(uid: string): DocumentReference {
    return doc(this.db, USERS, uid);
  }
}
