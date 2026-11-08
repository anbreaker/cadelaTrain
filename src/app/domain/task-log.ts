import { IsoDate } from './dates';
import { TaskKind } from './guidance';
import { collectErrors, ValidationRule } from './validation';

export const REACTIONS = ['calm', 'curious', 'fear'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const DEFAULT_ATTEMPTS = 10;
export const ATTEMPTS_MAX = 20;
export const NOTES_MAX = 1000;

/** One completion of a guidance task (`taskLogs`). Training and socialization details come in H3. */
export interface TaskLog {
  /** Training only. */
  attempts?: number;
  doneAt: Date;
  doneBy: string;
  guidanceDate: IsoDate;
  id: string;
  kind: TaskKind;
  notes: string;
  /** Socialization only. */
  reaction?: Reaction;
  skillKey?: string;
  /** Training only, 0…attempts. */
  successCount?: number;
  taskId: string;
}

/** What the trainer fills in when marking a task done (AC3.2–AC3.4). */
export interface TaskLogDraft {
  attempts?: number;
  notes: string;
  reaction?: Reaction;
  successCount?: number;
}

export type TaskLogError =
  'attemptsOutOfRange' | 'notesTooLong' | 'reactionRequired' | 'successCountOutOfRange';

interface Checked {
  draft: TaskLogDraft;
  kind: TaskKind;
}

const isIntBetween = (value: number | undefined, min: number, max: number): boolean =>
  value !== undefined && Number.isInteger(value) && value >= min && value <= max;

const TASK_LOG_RULES: readonly ValidationRule<Checked, TaskLogError>[] = [
  {
    code: 'attemptsOutOfRange',
    fails: ({ draft, kind }) =>
      kind === 'training' && !isIntBetween(draft.attempts, 1, ATTEMPTS_MAX),
  },
  {
    code: 'successCountOutOfRange',
    fails: ({ draft, kind }) =>
      kind === 'training' && !isIntBetween(draft.successCount, 0, draft.attempts ?? 0),
  },
  {
    code: 'reactionRequired',
    fails: ({ draft, kind }) =>
      kind === 'socialization' && !REACTIONS.some((reaction) => reaction === draft.reaction),
  },
  { code: 'notesTooLong', fails: ({ draft }) => draft.notes.trim().length > NOTES_MAX },
];

export const validateTaskLogDraft = (kind: TaskKind, draft: TaskLogDraft): TaskLogError[] =>
  collectErrors({ draft, kind }, TASK_LOG_RULES);

/** The latest completion of each task of the day, by task id (AC2.3). */
export function latestByTask(logs: readonly TaskLog[]): Map<string, TaskLog> {
  const latest = new Map<string, TaskLog>();
  for (const log of logs) {
    const current = latest.get(log.taskId);
    if (!current || current.doneAt < log.doneAt) latest.set(log.taskId, log);
  }
  return latest;
}
