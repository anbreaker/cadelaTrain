import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { IsoDate } from '@domain/dates';
import { TaskLog, TaskLogDraft } from '@domain/task-log';

import { FIRESTORE } from './firestore.token';
import { watchQuery } from './firestore-converter';
import {
  LogEntry,
  newSocializationLogData,
  newTaskLogData,
  taskLogConverter,
  taskLogResultData,
} from './task-log.converter';

import {
  collection,
  CollectionReference,
  doc,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

/** The log being edited or deleted: its id and the kind that decides its fields. */
export type LogRef = Pick<TaskLog, 'id' | 'kind'>;

/**
 * Task completions (`taskLogs`). A socialization log also writes the checklist entry
 * (`socializationLogs`) with the same id, in the same batch, so edits and deletes keep both in step.
 */
@Injectable({ providedIn: 'root' })
export class TaskLogRepository {
  private readonly db = inject(FIRESTORE);

  /** Stores a completion by `uid` at server time (AC3.1) and returns its id. */
  async log(householdId: string, dogId: string, entry: LogEntry, uid: string): Promise<string> {
    const ref = doc(this.logs(householdId, dogId));
    const batch = writeBatch(this.db).set(ref, newTaskLogData(entry, uid));
    const itemKey = entry.task.socializationItemKey;
    if (entry.task.kind === 'socialization' && itemKey) {
      batch.set(
        doc(this.socialization(householdId, dogId), ref.id),
        newSocializationLogData(itemKey, entry.draft, uid, ref.id)
      );
    }
    await batch.commit();
    return ref.id;
  }

  /** Changes the result; the rules allow it only to the author within 24 hours (AC3.6). */
  async update(
    householdId: string,
    dogId: string,
    log: LogRef,
    draft: TaskLogDraft
  ): Promise<void> {
    const result = taskLogResultData(log.kind, draft);
    const batch = writeBatch(this.db).update(doc(this.logs(householdId, dogId), log.id), {
      ...result,
    });
    if (log.kind === 'socialization') {
      batch.update(doc(this.socialization(householdId, dogId), log.id), {
        notes: result.notes,
        reaction: result.reaction,
      });
    }
    await batch.commit();
  }

  /** Deletes the log; the rules allow it only to the author within 24 hours (AC3.6). */
  async remove(householdId: string, dogId: string, log: LogRef): Promise<void> {
    const batch = writeBatch(this.db).delete(doc(this.logs(householdId, dogId), log.id));
    if (log.kind === 'socialization') {
      batch.delete(doc(this.socialization(householdId, dogId), log.id));
    }
    await batch.commit();
  }

  /** Completions of one guidance day, oldest first (index `guidanceDate` asc, `doneAt` asc). */
  watchDay(householdId: string, dogId: string, date: IsoDate): Observable<TaskLog[]> {
    const logs = this.logs(householdId, dogId).withConverter(taskLogConverter);
    return watchQuery(query(logs, where('guidanceDate', '==', date), orderBy('doneAt')));
  }

  private logs(householdId: string, dogId: string): CollectionReference {
    return collection(this.db, 'households', householdId, 'dogs', dogId, 'taskLogs');
  }

  private socialization(householdId: string, dogId: string): CollectionReference {
    return collection(this.db, 'households', householdId, 'dogs', dogId, 'socializationLogs');
  }
}
