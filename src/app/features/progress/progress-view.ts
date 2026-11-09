import { SKILLS } from '@domain/catalog';
import { IsoDate } from '@domain/dates';
import { skillProgress } from '@domain/progress';
import { TaskLog } from '@domain/task-log';

export interface TrendBar {
  /** Already formatted for the active language. */
  date: string;
  labelKey: string;
  /** Whole percentage of that day; `null` when the skill was not trained. */
  percent: null | number;
}

/** One skill on the progress screen (AC4.1–AC4.3). */
export interface SkillCardView {
  /** Never trained: the card shows the empty state (AC4.2). */
  empty: boolean;
  key: string;
  mastered: boolean;
  nameKey: string;
  rateKey: string;
  /** Whole percentage over the evaluation window; `null` without enough attempts. */
  ratePercent: null | number;
  sessions: number;
  trend: TrendBar[];
}

const toPercent = (rate: null | number): null | number =>
  rate === null ? null : Math.round(rate * 100);

/** Every catalog skill in teaching order, with its rate, mastery, trend and sessions. */
export const skillCards = (
  logs: readonly TaskLog[],
  today: IsoDate,
  formatDate: (date: IsoDate) => string
): SkillCardView[] =>
  SKILLS.map(({ key }) => {
    const progress = skillProgress(logs, key, today);
    const ratePercent = toPercent(progress.rate);
    return {
      empty: progress.sessions === 0,
      key,
      mastered: progress.mastered,
      nameKey: `catalog.skills.${key}.name`,
      ratePercent,
      rateKey: ratePercent === null ? 'progress.skills.noRate' : 'progress.skills.rate',
      sessions: progress.sessions,
      trend: progress.trend.map((point) => ({
        date: formatDate(point.date),
        labelKey:
          point.rate === null ? 'progress.skills.trendDayEmpty' : 'progress.skills.trendDay',
        percent: toPercent(point.rate),
      })),
    };
  });
