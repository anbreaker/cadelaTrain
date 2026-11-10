import { map, Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { IsoDate } from '@domain/dates';
import { Media, MediaDraft } from '@domain/media';

import { FIRESTORE } from './firestore.token';
import { watchQuery } from './firestore-converter';
import {
  mediaConverter,
  newPhotoMediaData,
  newVideoMediaData,
  PhotoRecord,
} from './media.converter';

import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentData,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

/** Newest date first; within a day, newest added first. */
const byDateThenAddedDesc = (a: Media, b: Media): number =>
  b.date.localeCompare(a.date) || b.addedAt.getTime() - a.addedAt.getTime();

/**
 * Photos and videos of a day (`media`). Only the document lives here: a photo's Cloudinary asset is
 * uploaded and removed through `api/` (AC7.2, AC7.6).
 */
@Injectable({ providedIn: 'root' })
export class MediaRepository {
  private readonly db = inject(FIRESTORE);

  /**
   * Items dated `from`…`to` (Madrid dates, both included). Firestore only orders by `date`, so the
   * single-field index serves it; the `addedAt` tie-break is applied here, needing no composite index.
   */
  watchRange(householdId: string, dogId: string, from: IsoDate, to: IsoDate): Observable<Media[]> {
    const items = query(
      this.media(householdId, dogId).withConverter(mediaConverter),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc')
    );
    return watchQuery(items).pipe(map((media) => [...media].sort(byDateThenAddedDesc)));
  }

  /** Stores a pasted YouTube link as its id, by `uid` at server time (AC7.3), and returns its id. */
  addVideo(householdId: string, dogId: string, draft: MediaDraft, uid: string): Promise<string> {
    return this.add(householdId, dogId, newVideoMediaData(draft, uid));
  }

  /** Records a photo already uploaded to Cloudinary (AC7.2) and returns its id. */
  addPhoto(householdId: string, dogId: string, photo: PhotoRecord, uid: string): Promise<string> {
    return this.add(householdId, dogId, newPhotoMediaData(photo, uid));
  }

  /** Deletes the document; the rules allow it only to its author (AC7.6). */
  async remove(householdId: string, dogId: string, mediaId: string): Promise<void> {
    await deleteDoc(doc(this.media(householdId, dogId), mediaId));
  }

  private async add(householdId: string, dogId: string, data: DocumentData): Promise<string> {
    const ref = doc(this.media(householdId, dogId));
    await setDoc(ref, data);
    return ref.id;
  }

  private media(householdId: string, dogId: string): CollectionReference {
    return collection(this.db, `households/${householdId}/dogs/${dogId}/media`);
  }
}
