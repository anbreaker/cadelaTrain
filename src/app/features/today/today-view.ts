import { DailyGuidance, groupBySlot, Slot } from '@domain/guidance';
import { HouseholdMember } from '@domain/household';
import { latestByTask, TaskLog } from '@domain/task-log';
import { TaskCardView } from '@shared/components/task-card/task-card';

export interface SlotView {
  cards: TaskCardView[];
  labelKey: string;
  slot: Slot;
}

/**
 * The day's tasks as cards grouped by slot (AC2.1), each marked with the latest completion: the
 * member's display name, or `null` once they left the household, and the local time (AC2.3).
 */
export function slotViews(
  guidance: DailyGuidance,
  logs: readonly TaskLog[],
  members: Readonly<Record<string, HouseholdMember>>,
  formatTime: (date: Date) => string
): SlotView[] {
  const done = latestByTask(logs);
  return groupBySlot(guidance.tasks).map(({ slot, tasks }) => ({
    cards: tasks.map((task) => {
      const log = done.get(task.id);
      return {
        done: log
          ? { at: formatTime(log.doneAt), by: members[log.doneBy]?.displayName ?? null }
          : null,
        durationMin: task.durationMin,
        id: task.id,
        instructions: task.instructions,
        kind: task.kind,
        title: task.title,
      };
    }),
    labelKey: `slots.${slot}`,
    slot,
  }));
}
