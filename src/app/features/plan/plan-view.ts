import { PLAN_WEEKS, planWeek, WeekAges } from '@domain/catalog';
import { addDays, IsoDate } from '@domain/dates';
import { DailyGuidance } from '@domain/guidance';
import { DayContext, SlotView, slotViews } from '@features/today/today-view';

export interface KeySkillView {
  cueKey: string;
  key: string;
  nameKey: string;
}

export interface PlanWeekView {
  ages: WeekAges;
  /** The dog's plan week right now. */
  current: boolean;
  howKey: string;
  keySkills: KeySkillView[];
  objectiveKey: string;
  readyWhenKey: string;
  week: number;
}

const DAYS_PER_WEEK = 7;

/** A day with no logs: the cards show the tasks only, never a completion or an Edit action. */
const NO_LOGS: DayContext = {
  formatTime: () => '',
  logs: [],
  members: {},
  now: new Date(0),
  uid: null,
};

const keySkill = (key: string): KeySkillView => ({
  cueKey: `catalog.skills.${key}.cue`,
  key,
  nameKey: `catalog.skills.${key}.name`,
});

/** The eight plan weeks with their texts and key skills; `currentWeek` is clamped to the plan. */
export function planWeekViews(currentWeek: number): PlanWeekView[] {
  const current = planWeek(currentWeek).week;
  return PLAN_WEEKS.map(({ ageWeeks, keySkills, week }) => ({
    ages: { from: ageWeeks.from, to: ageWeeks.to },
    current: week === current,
    howKey: `catalog.planWeeks.week${week}.how`,
    keySkills: keySkills.map(keySkill),
    objectiveKey: `catalog.planWeeks.week${week}.objective`,
    readyWhenKey: `catalog.planWeeks.week${week}.readyWhen`,
    week,
  }));
}

/** First day of a plan week: week 1 starts on the arrival date. */
export const weekStart = (arrivalDate: IsoDate, week: number): IsoDate =>
  addDays(arrivalDate, (week - 1) * DAYS_PER_WEEK);

/** A day's guidance as read-only cards grouped by slot. */
export const typicalDay = (guidance: DailyGuidance): SlotView[] => slotViews(guidance, NO_LOGS);
