import { isIsoDate, IsoDate } from '@domain/dates';
import { GuidanceTask, TASK_KINDS, TaskKind } from '@domain/guidance';
import {
  ATTEMPTS_MAX,
  Reaction,
  REACTIONS,
  SocializationLog,
  TaskLog,
  TaskLogDraft,
  validateTaskLogDraft,
} from '@domain/task-log';

import { ValidationFailedError } from './data-errors';
import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData, FieldValue, serverTimestamp } from 'firebase/firestore';

/** The guidance task being logged: what the log copies for queries. */
export type LoggedTask = Pick<GuidanceTask, 'id' | 'kind' | 'skillKey' | 'socializationItemKey'>;

export interface LogEntry {
  draft: TaskLogDraft;
  guidanceDate: IsoDate;
  task: LoggedTask;
}

/** The fields a trainer can change, by task kind (AC3.2–AC3.4). */
export interface TaskLogResultData {
  attempts?: number;
  notes: string;
  reaction?: Reaction;
  successCount?: number;
}

export type NewTaskLogData = TaskLogResultData & {
  doneAt: FieldValue;
  doneBy: string;
  guidanceDate: IsoDate;
  kind: TaskKind;
  skillKey?: string;
  taskId: string;
};

export interface NewSocializationLogData {
  doneAt: FieldValue;
  doneBy: string;
  itemKey: string;
  notes: string;
  reaction: Reaction;
  taskLogId: string;
}

type ResultBuilder = (draft: TaskLogDraft) => Partial<TaskLogResultData>;

const RESULT_FIELDS: Partial<Record<TaskKind, ResultBuilder>> = {
  socialization: (draft) => ({ reaction: draft.reaction }),
  training: (draft) => ({ attempts: draft.attempts, successCount: draft.successCount }),
};

/** Validates the draft and keeps only the fields of its kind, as `isTaskLog` in the rules requires. */
export function taskLogResultData(kind: TaskKind, draft: TaskLogDraft): TaskLogResultData {
  const errors = validateTaskLogDraft(kind, draft);
  if (errors.length > 0) throw new ValidationFailedError(errors);
  return { ...RESULT_FIELDS[kind]?.(draft), notes: draft.notes.trim() };
}

/** A completion authored now by `uid` (AC3.1): `doneAt` is the server time. */
export const newTaskLogData = (
  { draft, guidanceDate, task }: LogEntry,
  uid: string
): NewTaskLogData => ({
  ...taskLogResultData(task.kind, draft),
  doneAt: serverTimestamp(),
  doneBy: uid,
  guidanceDate,
  kind: task.kind,
  ...(task.skillKey ? { skillKey: task.skillKey } : {}),
  taskId: task.id,
});

/** The checklist entry written with a socialization task log, in the same batch. */
export const newSocializationLogData = (
  itemKey: string,
  draft: TaskLogDraft,
  uid: string,
  taskLogId: string
): NewSocializationLogData => {
  const { notes, reaction } = taskLogResultData('socialization', draft);
  return {
    doneAt: serverTimestamp(),
    doneBy: uid,
    itemKey,
    notes,
    reaction: reaction as Reaction,
    taskLogId,
  };
};

/** Optional fields stay absent, so the log equals what was written. */
const defined = <T extends object>(fields: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  ) as Partial<T>;

/** Reads who completed a task, when, and the result. */
export const parseTaskLog = (id: string, path: string, data: DocumentData): TaskLog => {
  const reader = new DocumentReader(path, data);
  return {
    ...defined({
      attempts: reader.optionalInteger('attempts', 1, ATTEMPTS_MAX),
      reaction: reader.optionalOneOf('reaction', REACTIONS),
      skillKey: reader.optionalKey('skillKey'),
      successCount: reader.optionalInteger('successCount', 0, ATTEMPTS_MAX),
    }),
    doneAt: reader.timestamp('doneAt'),
    doneBy: reader.string('doneBy'),
    guidanceDate: reader.stringWhere('guidanceDate', isIsoDate),
    id,
    kind: reader.oneOf('kind', TASK_KINDS),
    notes: reader.optionalString('notes'),
    taskId: reader.string('taskId'),
  };
};

export const taskLogConverter = readOnlyConverter(parseTaskLog);

/** Reads one checklist entry: the item, how she reacted, who did it and when. */
export const parseSocializationLog = (
  id: string,
  path: string,
  data: DocumentData
): SocializationLog => {
  const reader = new DocumentReader(path, data);
  return {
    doneAt: reader.timestamp('doneAt'),
    doneBy: reader.string('doneBy'),
    id,
    itemKey: reader.key('itemKey'),
    notes: reader.optionalString('notes'),
    reaction: reader.oneOf('reaction', REACTIONS),
  };
};

export const socializationLogConverter = readOnlyConverter(parseSocializationLog);
