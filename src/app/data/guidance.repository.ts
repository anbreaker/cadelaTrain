import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { IsoDate } from '@domain/dates';
import { DailyGuidance } from '@domain/guidance';

import { FIRESTORE } from './firestore.token';
import { watchDocument } from './firestore-converter';
import { guidanceConverter } from './guidance.converter';

import { doc } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class GuidanceRepository {
  private readonly db = inject(FIRESTORE);

  /** The stored guidance of a Madrid date, or `null` while none exists (the template fills in). */
  watchDay(householdId: string, dogId: string, date: IsoDate): Observable<DailyGuidance | null> {
    const ref = doc(
      this.db,
      'households',
      householdId,
      'dogs',
      dogId,
      'dailyGuidance',
      date
    ).withConverter(guidanceConverter);
    return watchDocument(ref);
  }
}
