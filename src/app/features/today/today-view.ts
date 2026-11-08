import { LoggedTask } from '@data/task-log.converter';
import { LogRef } from '@data/task-log.repository';
import { DailyGuidance, groupBySlot, GuidanceTask, Slot } from '@domain/guidance';
import { HouseholdMember } from '@domain/household';
import { TaskLog, TaskLogDraft } from '@domain/task-log';
import { TaskCardView } from '@shared/components/task-card/task-card';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface DayContext {
  formatTime: (date: Date) => string;
  logs: readonly TaskLog[];
  members: Readonly<Record<string, HouseholdMember>>;
  now: Date;
  /** The signed-in trainer. */
  uid: null | string;
}

/** The log I may still change (AC3.6) and its result, to start the sheet from. */
export interface EditableLog {
  draft: TaskLogDraft;
  log: LogRef;
}

export interface DayCard {
  edit: EditableLog | null;
  task: LoggedTask;
  view: TaskCardView;
}

export interface SlotView {
  cards: DayCard[];
  labelKey: string;
  slot: Slot;
}

const loggedTask = ({ id, kind, skillKey, socializationItemKey }: GuidanceTask): LoggedTask => ({
  id,
  kind,
  ...(skillKey ? { skillKey } : {}),
  ...(socializationItemKey ? { socializationItemKey } : {}),
});

const resultDraft = ({ attempts, notes, reaction, successCount }: TaskLog): TaskLogDraft => ({
  notes,
  ...(attempts === undefined ? {} : { attempts }),
  ...(reaction === undefined ? {} : { reaction }),
  ...(successCount === undefined ? {} : { successCount }),
});

/** Editable only when the latest log is mine and younger than 24 hours, as the rules require. */
const editable = (latest: TaskLog | undefined, day: DayContext): EditableLog | null =>
  latest &&
  latest.doneBy === day.uid &&
  day.now.getTime() - latest.doneAt.getTime() < EDIT_WINDOW_MS
    ? { draft: resultDraft(latest), log: { id: latest.id, kind: latest.kind } }
    : null;

function dayCard(task: GuidanceTask, day: DayContext): DayCard {
  const logs = day.logs.filter((log) => log.taskId === task.id);
  const latest = logs.reduce<TaskLog | undefined>(
    (newest, log) => (!newest || newest.doneAt < log.doneAt ? log : newest),
    undefined
  );
  const edit = editable(latest, day);
  return {
    edit,
    task: loggedTask(task),
    view: {
      canEdit: edit !== null,
      count: logs.length,
      done: latest
        ? { at: day.formatTime(latest.doneAt), by: day.members[latest.doneBy]?.displayName ?? null }
        : null,
      durationMin: task.durationMin,
      id: task.id,
      instructions: task.instructions,
      kind: task.kind,
      title: task.title,
    },
  };
}

/**
 * The day's tasks as cards grouped by slot (AC2.1): each with its latest completion (member name, or
 * `null` once they left the household, and local time, AC2.3), the count (AC3.5) and whether I can
 * still edit it (AC3.6).
 */
export const slotViews = (guidance: DailyGuidance, day: DayContext): SlotView[] =>
  groupBySlot(guidance.tasks).map(({ slot, tasks }) => ({
    cards: tasks.map((task) => dayCard(task, day)),
    labelKey: `slots.${slot}`,
    slot,
  }));
