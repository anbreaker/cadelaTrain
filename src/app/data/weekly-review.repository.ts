import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { IsoDate } from '@domain/dates';
import { WeeklyReview, WeeklyReviewDraft } from '@domain/weekly-review';

import { FIRESTORE } from './firestore.token';
import { watchDocument } from './firestore-converter';
import {
  newWeeklyReviewData,
  newWeightLogData,
  weeklyReviewConverter,
} from './weekly-review.converter';

import { collection, doc, DocumentReference, writeBatch } from 'firebase/firestore';

export interface WeeklyReviewEntry {
  draft: WeeklyReviewDraft;
  /** Madrid date a new weight is logged on. */
  measuredOn: IsoDate;
  weekNumber: number;
}

/** Weekly reviews (`weeklyReviews/{weekNumber}`) and the weight logs they add (AC5.3). */
@Injectable({ providedIn: 'root' })
export class WeeklyReviewRepository {
  private readonly db = inject(FIRESTORE);

  /** The stored review of a week, or `null` while nobody wrote it. */
  watchWeek(
    householdId: string,
    dogId: string,
    weekNumber: number
  ): Observable<null | WeeklyReview> {
    return watchDocument(
      this.reviewRef(householdId, dogId, weekNumber).withConverter(weeklyReviewConverter)
    );
  }

  /**
   * Any member saves the whole review as its last editor. A weight different from the stored one
   * (`previousWeightKg`) is also added as a weight log, in the same batch.
   */
  async save(
    householdId: string,
    dogId: string,
    { draft, measuredOn, weekNumber }: WeeklyReviewEntry,
    uid: string,
    previousWeightKg: null | number
  ): Promise<void> {
    const batch = writeBatch(this.db).set(
      this.reviewRef(householdId, dogId, weekNumber),
      newWeeklyReviewData(weekNumber, draft, uid)
    );
    if (draft.weightKg !== null && draft.weightKg !== previousWeightKg) {
      const weightLog = doc(collection(this.db, this.dogPath(householdId, dogId), 'weightLogs'));
      batch.set(weightLog, newWeightLogData(draft.weightKg, measuredOn, uid));
    }
    await batch.commit();
  }

  private dogPath(householdId: string, dogId: string): string {
    return `households/${householdId}/dogs/${dogId}`;
  }

  private reviewRef(householdId: string, dogId: string, weekNumber: number): DocumentReference {
    return doc(this.db, this.dogPath(householdId, dogId), 'weeklyReviews', String(weekNumber));
  }
}
