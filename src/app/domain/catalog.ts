import careAlertsSeed from '../../../seed/care-alerts.json';
import scheduleSeed from '../../../seed/daily-schedule.json';
import planWeeksSeed from '../../../seed/plan-weeks.json';
import preparationSeed from '../../../seed/preparation-checklist.json';
import principlesSeed from '../../../seed/principles.json';
import routineGuidesSeed from '../../../seed/routine-guides.json';
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
  /** Guide shown on the card: a skill key or a routine guide key. */
  guideKey?: string;
  id: string;
  isTask: boolean;
  kind: TaskKind;
  skillKey?: string;
  slot: Slot;
  time: string;
  /** Canonical English title; the UI text is `catalog.schedule.<id>.title`. */
  title: string;
}

/** Age range in weeks of a plan week. */
export interface WeekAges {
  from: number;
  to: number;
}

export interface PlanWeek {
  ageWeeks: WeekAges;
  focusSkills: string[];
  keySkills: string[];
  week: number;
}

export interface Skill {
  /** Canonical English trainer guide; the UI text lives in `catalog.skills.<key>.howTo`. */
  howTo: { steps: readonly string[] };
  key: string;
}

/** A trainer guide for a routine that is not a skill (socialization, handling, brushing, kennel). */
export interface RoutineGuide {
  /** Canonical English guide; the UI text lives in `catalog.routines.<key>.howTo`. */
  howTo: { steps: readonly string[] };
  key: string;
}

/** Translation keys of a trainer guide ("how to do it"), steps in order. */
export interface SkillHowTo {
  levelUpKey: string;
  mistakesKey: string;
  setupKey: string;
  stepKeys: readonly string[];
  troubleshootKey: string;
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
  /** Canonical English explanation; the UI text is `catalog.preparation.<key>.hint`. */
  hint?: string;
  key: string;
  /** Nice to have, not needed by every household. */
  optional?: boolean;
  order: number;
}

/** How the household trains: shown on the rules screen and summarized in the engine prompt. */
export interface Principle {
  key: string;
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
/** Checklist groups, in display order. */
export const SOCIALIZATION_CATEGORIES: readonly string[] = socializationSeed.categories;
export const CARE_ALERTS = careAlertsSeed.items as CareAlert[];
/** In display order. */
export const PRINCIPLES = principlesSeed.items as Principle[];

/** In display order. */
export const ROUTINE_GUIDES = routineGuidesSeed.items as RoutineGuide[];

const howToKeys = (prefix: string, steps: readonly string[]): SkillHowTo => ({
  levelUpKey: `${prefix}.levelUp`,
  mistakesKey: `${prefix}.mistakes`,
  setupKey: `${prefix}.setup`,
  stepKeys: steps.map((_, index) => `${prefix}.step${index + 1}`),
  troubleshootKey: `${prefix}.troubleshoot`,
});

/** The trainer guide of a skill, or `null` when the catalog does not know the skill. */
export function skillHowTo(skillKey: string): null | SkillHowTo {
  const skill = SKILLS.find(({ key }) => key === skillKey);
  return skill ? howToKeys(`catalog.skills.${skillKey}.howTo`, skill.howTo.steps) : null;
}

/** The guide a schedule row names: a skill guide first, else a routine guide, else `null`. */
export function guideHowTo(guideKey: string): null | SkillHowTo {
  const routine = ROUTINE_GUIDES.find(({ key }) => key === guideKey);
  return (
    skillHowTo(guideKey) ??
    (routine ? howToKeys(`catalog.routines.${guideKey}.howTo`, routine.howTo.steps) : null)
  );
}
/** In checklist order. */
export const PREPARATION_ITEMS = [...(preparationSeed.items as PreparationItem[])].sort(
  (a, b) => a.order - b.order
);

/** The plan week, clamped to the 8-week plan. */
export function planWeek(week: number): PlanWeek {
  const index = Math.min(Math.max(week, 1), PLAN_WEEKS.length) - 1;
  return PLAN_WEEKS[index];
}
