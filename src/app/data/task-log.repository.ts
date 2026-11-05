import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { IsoDate } from '@domain/dates';
import { TaskLog } from '@domain/task-log';

import { FIRESTORE } from './firestore.token';
import { watchQuery } from './firestore-converter';
import { taskLogConverter } from './task-log.converter';

import { collection, orderBy, query, where } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class TaskLogRepository {
  private readonly db = inject(FIRESTORE);

  /** Completions of one guidance day, oldest first (index `guidanceDate` asc, `doneAt` asc). */
  watchDay(householdId: string, dogId: string, date: IsoDate): Observable<TaskLog[]> {
    const logs = collection(
      this.db,
      'households',
      householdId,
      'dogs',
      dogId,
      'taskLogs'
    ).withConverter(taskLogConverter);
    return watchQuery(query(logs, where('guidanceDate', '==', date), orderBy('doneAt')));
  }
}
