import { inject, Injectable } from '@angular/core';

import { normalizeEmail } from '@domain/email';

import { FIRESTORE } from './firestore.token';

import { doc, getDoc } from 'firebase/firestore';

/**
 * The app is private to one household: `allowedEmails/{lowercased email}` lists who may use it.
 * The documents are created in the Firebase console; the rules let a user read only their own.
 */
@Injectable({ providedIn: 'root' })
export class AccessRepository {
  private readonly db = inject(FIRESTORE);

  async hasAccess(email: string): Promise<boolean> {
    const entry = await getDoc(doc(this.db, 'allowedEmails', normalizeEmail(email)));
    return entry.exists();
  }
}
