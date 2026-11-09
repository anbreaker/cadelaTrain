import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { IsoDate } from '@domain/dates';
import { Dog, DogDraft } from '@domain/dog';

import { dogConverter, dogUpdateData, newDogData, planWeekUpdateData } from './dog.converter';
import { FIRESTORE } from './firestore.token';
import { watchQuery } from './firestore-converter';

import {
  addDoc,
  collection,
  CollectionReference,
  doc,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';

const HOUSEHOLDS = 'households';
const DOGS = 'dogs';

@Injectable({ providedIn: 'root' })
export class DogRepository {
  private readonly db = inject(FIRESTORE);

  /** `today` is the Madrid date (`madridToday`) used to reject a birth date in the future. */
  async create(householdId: string, draft: DogDraft, today: IsoDate): Promise<string> {
    const ref = await addDoc(this.dogs(householdId), newDogData(draft, today));
    return ref.id;
  }

  async update(householdId: string, dogId: string, draft: DogDraft, today: IsoDate): Promise<void> {
    await updateDoc(doc(this.dogs(householdId), dogId), dogUpdateData(draft, today));
  }

  /** Moves the dog to `planWeek` (the next week, `planWeekFor`), touching nothing else. */
  async advancePlanWeek(householdId: string, dogId: string, planWeek: number): Promise<void> {
    await updateDoc(doc(this.dogs(householdId), dogId), { ...planWeekUpdateData(planWeek) });
  }

  watchAll(householdId: string): Observable<Dog[]> {
    const dogs = this.dogs(householdId).withConverter(dogConverter);
    return watchQuery(query(dogs, orderBy('createdAt')));
  }

  private dogs(householdId: string): CollectionReference {
    return collection(this.db, HOUSEHOLDS, householdId, DOGS);
  }
}
