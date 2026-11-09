import careAlertsSeed from '../../../seed/care-alerts.json';
import scheduleSeed from '../../../seed/daily-schedule.json';
import planWeeksSeed from '../../../seed/plan-weeks.json';
import preparationSeed from '../../../seed/preparation-checklist.json';
import skillsSeed from '../../../seed/skills.json';
import socializationSeed from '../../../seed/socialization-checklist.json';
import { Environment } from './dog';
import { Slot, TaskKind } from './guidance';

/**
 * Bundled catalogs (`seed/*.json`): structure and canonical English text. UI text lives in
 * Transloco under each file's `i18nPrefix`; item keys are camelCase.
 */
export interface ScheduleRow {
  durationMin: null | number;
  id: string;
  isTask: boolean;
  kind: TaskKind;
  skillKey?: string;
  slot: Slot;
  time: string;
  /** Canonical English title; the UI text is `catalog.schedule.<id>.title`. */
  title: string;
}

export interface PlanWeek {
  focusSkills: string[];
  keySkills: string[];
  week: number;
}

export interface Skill {
  key: string;
}

export interface SocializationItem {
  category: string;
  key: string;
  /** Canonical English label; the UI text is `catalog.socialization.items.<key>.label`. */
  label: string;
  order: number;
}

/** Things to have ready before the dog arrives. */
export interface PreparationItem {
  key: string;
  order: number;
}

export type AlertSeverity = 'info' | 'urgent' | 'vet';

export interface CareAlert {
  appliesTo: { environment?: Environment; sleepsOutdoors?: boolean };
  /** Only during that week since arrival (1 = the first seven days). */
  arrivalWeek?: number;
  key: string;
  months: number[];
  severity: AlertSeverity;
}

export const SCHEDULE = scheduleSeed.items as ScheduleRow[];
export const PLAN_WEEKS = planWeeksSeed.items as PlanWeek[];
/** In teaching order: easiest first. */
export const SKILLS = skillsSeed.items as Skill[];
export const SOCIALIZATION_ITEMS = socializationSeed.items as SocializationItem[];
export const CARE_ALERTS = careAlertsSeed.items as CareAlert[];
/** In checklist order. */
export const PREPARATION_ITEMS = [...(preparationSeed.items as PreparationItem[])].sort(
  (a, b) => a.order - b.order
);

/** The plan week, clamped to the 8-week plan. */
export function planWeek(week: number): PlanWeek {
  const index = Math.min(Math.max(week, 1), PLAN_WEEKS.length) - 1;
  return PLAN_WEEKS[index];
}
