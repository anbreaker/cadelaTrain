import { planWeek as planWeekOf } from './catalog';
import { ageInWeeks, IsoDate } from './dates';
import { MASTERED_RATE, skillRate, weekAttempts } from './progress';
import { TaskLog } from './task-log';

export const LAST_PLAN_WEEK = 8;
/** Week 1 starts at 8 weeks of age, so the plan week is never more than `ageWeeks − 7`. */
const AGE_OFFSET = 7;

export interface PlanWeekInput {
  birthDate: IsoDate;
  logs: readonly TaskLog[];
  planWeek: number;
  /** Madrid date (`madridToday`). */
  today: IsoDate;
}

/** One key skill of the current week against the advance rule. */
export interface KeySkillStatus {
  /** Attempts in the last 7 days; the rate needs at least 10. */
  attempts: number;
  /** Rate ≥ 0.8 over the evaluation window. */
  met: boolean;
  /** `skillRate`; `null` with fewer than 10 attempts. */
  rate: null | number;
  skillKey: string;
}

/** What stands between the current plan week and the next one (`specs/04-guidance-engine.md`). */
export interface WeekAdvance {
  /** The dog is old enough for the next week. */
  ageAllows: boolean;
  keySkills: KeySkillStatus[];
  /** Age in weeks from which the next week is allowed; `null` at the last week. */
  minAgeWeeks: null | number;
  /** `null` at the last week of the plan. */
  nextWeek: null | number;
}

export function weekAdvance({ birthDate, logs, planWeek, today }: PlanWeekInput): WeekAdvance {
  const keySkills = planWeekOf(planWeek).keySkills.map((skillKey): KeySkillStatus => {
    const rate = skillRate(logs, skillKey, today);
    return {
      attempts: weekAttempts(logs, skillKey, today),
      met: rate !== null && rate >= MASTERED_RATE,
      rate,
      skillKey,
    };
  });
  const nextWeek = planWeek < LAST_PLAN_WEEK ? planWeek + 1 : null;
  const minAgeWeeks = nextWeek === null ? null : nextWeek + AGE_OFFSET;

  return {
    ageAllows: minAgeWeeks !== null && ageInWeeks(birthDate, today) >= minAgeWeeks,
    keySkills,
    minAgeWeeks,
    nextWeek,
  };
}

/**
 * The plan week to use: `planWeek + 1` once every key skill of the current week has a rate of at
 * least 0.8 and the age cap allows it; otherwise `planWeek`. It never goes back.
 */
export function planWeekFor(input: PlanWeekInput): number {
  const { ageAllows, keySkills, nextWeek } = weekAdvance(input);
  return nextWeek !== null && ageAllows && keySkills.every((skill) => skill.met)
    ? nextWeek
    : input.planWeek;
}
