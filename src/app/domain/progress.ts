import { SocializationItem } from './catalog';
import { addDays, daysUntil, IsoDate } from './dates';
import { Reaction, SocializationLog, TaskLog } from './task-log';

/** Evaluation window (`specs/04-guidance-engine.md`): the newest 10 attempts within 7 days. */
export const WINDOW_DAYS = 7;
export const WINDOW_ATTEMPTS = 10;
export const MASTERED_RATE = 0.8;
export const TREND_DAYS = 14;
/** The socialization window closes at 16 weeks of age (`seed/socialization-checklist.json`). */
export const SOCIALIZATION_DEADLINE_WEEKS = 16;

export interface TrendPoint {
  date: IsoDate;
  /** Successes / attempts of that day; `null` when the skill was not trained. */
  rate: null | number;
}

export interface SkillProgress {
  mastered: boolean;
  /** Rate over the evaluation window; `null` with fewer than 10 attempts. */
  rate: null | number;
  /** Training logs of the skill, ever. */
  sessions: number;
  trend: TrendPoint[];
}

interface Totals {
  attempts: number;
  successes: number;
}

const trainingOf = (logs: readonly TaskLog[], skillKey: string): TaskLog[] =>
  logs.filter((log) => log.kind === 'training' && log.skillKey === skillKey && !!log.attempts);

const add = (totals: Totals, log: TaskLog): Totals => ({
  attempts: totals.attempts + (log.attempts ?? 0),
  successes: totals.successes + (log.successCount ?? 0),
});

const ratio = ({ attempts, successes }: Totals): null | number =>
  attempts > 0 ? successes / attempts : null;

/** Training logs of the skill in the last 7 Madrid days, newest first. */
const lastWeekOf = (logs: readonly TaskLog[], skillKey: string, today: IsoDate): TaskLog[] => {
  const since = addDays(today, 1 - WINDOW_DAYS);
  return trainingOf(logs, skillKey)
    .filter((log) => log.guidanceDate >= since && log.guidanceDate <= today)
    .sort((a, b) => b.doneAt.getTime() - a.doneAt.getTime());
};

/**
 * Success rate of a skill over the evaluation window: training logs of the last 7 Madrid days,
 * newest first, are added whole (never split) until they reach 10 attempts.
 */
export function skillRate(
  logs: readonly TaskLog[],
  skillKey: string,
  today: IsoDate
): null | number {
  let totals: Totals = { attempts: 0, successes: 0 };
  for (const log of lastWeekOf(logs, skillKey, today)) {
    totals = add(totals, log);
    if (totals.attempts >= WINDOW_ATTEMPTS) return ratio(totals);
  }
  return null;
}

/** Attempts of the skill in the last 7 Madrid days: the rate needs at least 10 of them. */
export const weekAttempts = (logs: readonly TaskLog[], skillKey: string, today: IsoDate): number =>
  lastWeekOf(logs, skillKey, today).reduce(add, { attempts: 0, successes: 0 }).attempts;

/** What the progress screen shows for one skill (AC4.2, AC4.3). */
export function skillProgress(
  logs: readonly TaskLog[],
  skillKey: string,
  today: IsoDate
): SkillProgress {
  const training = trainingOf(logs, skillKey);
  const rate = skillRate(training, skillKey, today);
  const trend = Array.from({ length: TREND_DAYS }, (_, index): TrendPoint => {
    const date = addDays(today, index + 1 - TREND_DAYS);
    const day = training
      .filter((log) => log.guidanceDate === date)
      .reduce(add, { attempts: 0, successes: 0 });
    return { date, rate: ratio(day) };
  });

  return {
    mastered: rate !== null && rate >= MASTERED_RATE,
    rate,
    sessions: training.length,
    trend,
  };
}

/** One checklist item on the progress screen (AC4.4). */
export interface SocializationStatus {
  /** Done once she met it calm or curious, as `pendingSocialization` in the engine. */
  done: boolean;
  item: SocializationItem;
  /** uid of whoever logged the last reaction. */
  lastBy: null | string;
  lastReaction: null | Reaction;
  /** The last reaction was fear: repeat at a lower intensity. */
  repeatGently: boolean;
}

const POSITIVE: readonly Reaction[] = ['calm', 'curious'];

/** Each catalog item with its newest reaction, in the order given. */
export function socializationStatus(
  items: readonly SocializationItem[],
  logs: readonly SocializationLog[]
): SocializationStatus[] {
  const newestFirst = [...logs].sort((a, b) => b.doneAt.getTime() - a.doneAt.getTime());
  return items.map((item) => {
    const ofItem = newestFirst.filter((log) => log.itemKey === item.key);
    const last = ofItem[0];
    return {
      done: ofItem.some((log) => POSITIVE.includes(log.reaction)),
      item,
      lastBy: last?.doneBy ?? null,
      lastReaction: last?.reaction ?? null,
      repeatGently: last?.reaction === 'fear',
    };
  });
}

/** Days left until 16 weeks of age; 0 once reached (AC4.5). */
export const daysToSocializationDeadline = (birthDate: IsoDate, today: IsoDate): number =>
  Math.max(0, daysUntil(addDays(birthDate, SOCIALIZATION_DEADLINE_WEEKS * 7), today));
