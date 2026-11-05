import { IsoDate } from './dates';
import { TaskKind } from './guidance';

/** One completion of a guidance task (`taskLogs`). Training and socialization details come in H3. */
export interface TaskLog {
  doneAt: Date;
  doneBy: string;
  guidanceDate: IsoDate;
  id: string;
  kind: TaskKind;
  notes: string;
  skillKey?: string;
  taskId: string;
}

/** The latest completion of each task of the day, by task id (AC2.3). */
export function latestByTask(logs: readonly TaskLog[]): Map<string, TaskLog> {
  const latest = new Map<string, TaskLog>();
  for (const log of logs) {
    const current = latest.get(log.taskId);
    if (!current || current.doneAt < log.doneAt) latest.set(log.taskId, log);
  }
  return latest;
}
