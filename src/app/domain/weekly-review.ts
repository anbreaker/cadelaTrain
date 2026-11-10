import { SKILLS, SOCIALIZATION_ITEMS } from './catalog';
import { addDays, ageInWeeks, daysUntil, IsoDate, madridToday } from './dates';
import { planWeekFor } from './plan-week';
import { MASTERED_RATE, skillRate } from './progress';
import { Reaction, SocializationLog, TaskLog } from './task-log';

const DAYS_PER_WEEK = 7;
/** Below this rate, with a full evaluation window, a skill is struggling (AC5.2). */
export const STRUGGLING_RATE = 0.5;

const POSITIVE: readonly Reaction[] = ['calm', 'curious'];

/** A review week: week 1 is the arrival day plus six days (AC5.1). */
export interface ReviewWeek {
  end: IsoDate;
  number: number;
  start: IsoDate;
}

export interface WeeklySummaryInput {
  dog: { arrivalDate: IsoDate; birthDate: IsoDate; planWeek: number };
  logs: readonly TaskLog[];
  socialization: readonly SocializationLog[];
  /** Madrid date. */
  today: IsoDate;
  week: number;
}

/** What a review week shows on its own, computed from the logs (AC5.1, AC5.2). */
export interface WeeklySummary {
  /** Age on the week's last day, or today while the week is in progress. */
  ageWeeks: number;
  /** Skill keys at 80 % or more, in catalog order. */
  doesWell: string[];
  /** Socialization item keys first met calm or curious that week, in catalog order. */
  newSocialization: string[];
  objectiveKey: string;
  planWeek: number;
  /** Skill keys under 50 % with a full evaluation window, in catalog order. */
  struggles: string[];
  week: ReviewWeek;
}

/** The review week a date belongs to; `null` before the arrival. */
export const reviewWeekOf = (arrivalDate: IsoDate, date: IsoDate): null | number => {
  const days = daysUntil(date, arrivalDate);
  return days < 0 ? null : Math.floor(days / DAYS_PER_WEEK) + 1;
};

export const reviewWeek = (arrivalDate: IsoDate, number: number): ReviewWeek => {
  const start = addDays(arrivalDate, (number - 1) * DAYS_PER_WEEK);
  return { end: addDays(start, DAYS_PER_WEEK - 1), number, start };
};

/**
 * The plan week a past date had: Today advances at most one week per day it opens, so the rule
 * is replayed day by day from the arrival. It never goes above the week stored on the dog.
 */
function replayedPlanWeek(
  { arrivalDate, birthDate, planWeek }: WeeklySummaryInput['dog'],
  logs: readonly TaskLog[],
  until: IsoDate
): number {
  let week = 1;
  for (let day = arrivalDate; day <= until; day = addDays(day, 1))
    week = planWeekFor({ birthDate, logs, planWeek: week, today: day });
  return Math.min(week, planWeek);
}

/** The first Madrid date each item was met calm or curious. */
function firstDoneDates(socialization: readonly SocializationLog[]): Map<string, IsoDate> {
  const first = new Map<string, IsoDate>();
  for (const log of socialization) {
    if (!POSITIVE.includes(log.reaction)) continue;
    const date = madridToday(log.doneAt);
    const known = first.get(log.itemKey);
    if (!known || date < known) first.set(log.itemKey, date);
  }
  return first;
}

export function weeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const { dog, logs, socialization, today } = input;
  const week = reviewWeek(dog.arrivalDate, input.week);
  const inProgress = week.end >= today;
  const asOf = inProgress ? today : week.end;
  const rates = SKILLS.map(({ key }) => ({ key, rate: skillRate(logs, key, asOf) }));
  const planWeek = inProgress ? dog.planWeek : replayedPlanWeek(dog, logs, asOf);
  const firstDone = firstDoneDates(socialization);
  const doneThisWeek = (key: string): boolean => {
    const date = firstDone.get(key);
    return date !== undefined && date >= week.start && date <= asOf;
  };

  return {
    ageWeeks: ageInWeeks(dog.birthDate, asOf),
    doesWell: rates
      .filter(({ rate }) => rate !== null && rate >= MASTERED_RATE)
      .map(({ key }) => key),
    newSocialization: SOCIALIZATION_ITEMS.map(({ key }) => key).filter(doneThisWeek),
    objectiveKey: `catalog.planWeeks.week${planWeek}.objective`,
    planWeek,
    struggles: rates
      .filter(({ rate }) => rate !== null && rate < STRUGGLING_RATE)
      .map(({ key }) => key),
    week,
  };
}
