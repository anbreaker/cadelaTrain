import { Observable } from 'rxjs';

import { InvalidDocumentError } from './data-errors';

import {
  DocumentData,
  DocumentReference,
  FirestoreDataConverter,
  onSnapshot,
  Query,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';

export type DocumentParser<T> = (id: string, path: string, data: DocumentData) => T;

/**
 * Writes never go through converters: they need `serverTimestamp()` sentinels and the exact shapes
 * the rules accept, which the `new*Data` builders produce. Converters only validate reads.
 */
export function readOnlyConverter<T>(parse: DocumentParser<T>): FirestoreDataConverter<T> {
  return {
    fromFirestore: (snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): T =>
      parse(snapshot.id, snapshot.ref.path, snapshot.data(options)),
    toFirestore: (): never => {
      throw new Error('Read-only converter: build write data with the new*Data functions');
    },
  };
}

const readValid = <T>(snapshot: QueryDocumentSnapshot<T>): T[] => {
  try {
    return [snapshot.data()];
  } catch (error) {
    if (!(error instanceof InvalidDocumentError)) throw error;
    // One malformed document must not hide the valid ones in a list.
    console.warn(error.message);
    return [];
  }
};

export const validDocs = <T>(snapshots: readonly QueryDocumentSnapshot<T>[]): T[] =>
  snapshots.flatMap(readValid);

export function watchQuery<T>(source: Query<T>): Observable<T[]> {
  return new Observable<T[]>((subscriber) =>
    onSnapshot(source, {
      error: (error) => subscriber.error(error),
      next: (snapshot) => subscriber.next(validDocs(snapshot.docs)),
    })
  );
}

/** Emits `null` while the document does not exist; a malformed document errors the stream. */
export function watchDocument<T>(ref: DocumentReference<T>): Observable<T | null> {
  return new Observable<T | null>((subscriber) =>
    onSnapshot(ref, {
      error: (error) => subscriber.error(error),
      next: (snapshot) => {
        try {
          subscriber.next(snapshot.exists() ? snapshot.data() : null);
        } catch (error) {
          subscriber.error(error);
        }
      },
    })
  );
}
