import { IsoDate } from './dates';
import { Locale } from './household';

/** Time slots of the day, in display order (AC2.1). */
export const SLOTS = ['morning', 'midday', 'afternoon', 'night'] as const;
export type Slot = (typeof SLOTS)[number];

export const TASK_KINDS = ['care', 'feeding', 'potty', 'socialization', 'training'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Set by a health note (H3); the UI only ever shows the matching fixed phrase. */
export type HealthFlag = 'urgent' | 'vet' | null;

export type GuidanceSource = 'ai' | 'template';

export interface GuidanceTask {
  /** Skill practised at the end of a training session, so it ends with a success. */
  closingSkillKey?: string;
  /** Minutes; `null` for tasks without a fixed length (meals, bedtime). */
  durationMin: null | number;
  /** Guide shown on the card when it is not the skill's own (routines, potty walks). */
  guideKey?: string;
  id: string;
  instructions: string;
  kind: TaskKind;
  order: number;
  skillKey?: string;
  slot: Slot;
  socializationItemKey?: string;
  title: string;
}

export interface DailyGuidance {
  ageWeeks: number;
  date: IsoDate;
  healthFlag: HealthFlag;
  locale: Locale;
  planWeek: number;
  source: GuidanceSource;
  summary: string;
  tasks: GuidanceTask[];
}

export interface SlotGroup {
  slot: Slot;
  tasks: GuidanceTask[];
}

const byOrder = (a: GuidanceTask, b: GuidanceTask): number => a.order - b.order;

/** Tasks grouped by slot in day order; slots without tasks are left out (AC2.1). */
export function groupBySlot(tasks: readonly GuidanceTask[]): SlotGroup[] {
  return SLOTS.map((slot) => ({
    slot,
    tasks: tasks.filter((task) => task.slot === slot).sort(byOrder),
  })).filter((group) => group.tasks.length > 0);
}

const HEALTH_MESSAGE_KEYS: Record<NonNullable<HealthFlag>, string> = {
  urgent: 'health.vetEmergency',
  vet: 'health.consultVet',
};

/** The only health text the app shows (domain rule 2, AC2.6). */
export const healthMessageKey = (flag: HealthFlag): null | string =>
  flag ? HEALTH_MESSAGE_KEYS[flag] : null;

export const taskKindLabelKey = (kind: TaskKind): string => `taskKinds.${kind}`;
