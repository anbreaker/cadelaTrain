import { SKILLS, SOCIALIZATION_CATEGORIES } from '@domain/catalog';
import { IsoDate } from '@domain/dates';
import { HouseholdMember } from '@domain/household';
import { skillProgress, SocializationStatus } from '@domain/progress';
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

/** One checklist item on the progress screen (AC4.4). */
export interface SocializationItemView {
  /** Name of whoever logged the last reaction. */
  by: null | string;
  key: string;
  labelKey: string;
  reactionKey: null | string;
  repeatGently: boolean;
  statusKey: string;
}

export interface SocializationGroupView {
  category: string;
  items: SocializationItemView[];
  labelKey: string;
}

/** The checklist grouped by category, each group in checklist order. */
export const socializationGroups = (
  statuses: readonly SocializationStatus[],
  members: Readonly<Record<string, HouseholdMember>>
): SocializationGroupView[] =>
  SOCIALIZATION_CATEGORIES.map((category) => ({
    category,
    items: statuses
      .filter(({ item }) => item.category === category)
      .sort((a, b) => a.item.order - b.item.order)
      .map((status) => ({
        by: status.lastBy ? (members[status.lastBy]?.displayName ?? null) : null,
        key: status.item.key,
        labelKey: `catalog.socialization.items.${status.item.key}.label`,
        reactionKey: status.lastReaction ? `reactions.${status.lastReaction}` : null,
        repeatGently: status.repeatGently,
        statusKey: status.done ? 'progress.socialization.done' : 'progress.socialization.pending',
      })),
    labelKey: `catalog.socialization.categories.${category}`,
  }));
