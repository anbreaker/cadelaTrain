import { SKILLS, SOCIALIZATION_CATEGORIES } from '@domain/catalog';
import { IsoDate } from '@domain/dates';
import { HouseholdMember } from '@domain/household';
import { KeySkillStatus, WeekAdvance } from '@domain/plan-week';
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

/** One key skill of the current week against the advance rule (S2). */
export interface KeySkillView {
  /** Attempts in the last 7 days, shown against the 10 the rate needs. */
  attempts: number;
  attemptsKey: string;
  key: string;
  met: boolean;
  nameKey: string;
  rateKey: string;
  /** Whole percentage, shown against 80 %; `null` without enough attempts. */
  ratePercent: null | number;
}

/** What is missing for the next plan week; at week 8 only the last-week note. */
export interface NextWeekView {
  /** Set while she is too young for the next week. */
  ageKey: null | string;
  hintKey: null | string;
  minAgeWeeks: null | number;
  skills: KeySkillView[];
  titleKey: string;
  week: null | number;
}

const keySkillView = (skill: KeySkillStatus): KeySkillView => {
  const ratePercent = toPercent(skill.rate);
  return {
    attempts: skill.attempts,
    attemptsKey: 'progress.nextWeek.attempts',
    key: skill.skillKey,
    met: skill.met,
    nameKey: `catalog.skills.${skill.skillKey}.name`,
    rateKey: ratePercent === null ? 'progress.nextWeek.noRate' : 'progress.nextWeek.rate',
    ratePercent,
  };
};

export const nextWeekView = (advance: WeekAdvance): NextWeekView => {
  const last = advance.nextWeek === null;
  return {
    ageKey: last || advance.ageAllows ? null : 'progress.nextWeek.age',
    hintKey: last ? null : 'progress.nextWeek.hint',
    minAgeWeeks: advance.minAgeWeeks,
    skills: last ? [] : advance.keySkills.map(keySkillView),
    titleKey: last ? 'progress.nextWeek.lastWeek' : 'progress.nextWeek.title',
    week: advance.nextWeek,
  };
};

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
