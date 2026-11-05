import {
  CARE_ALERTS,
  CareAlert,
  planWeek,
  SCHEDULE,
  ScheduleRow,
  SKILLS,
  SOCIALIZATION_ITEMS,
} from './catalog';
import { ageInWeeks, daysUntil, IsoDate } from './dates';
import { Dog } from './dog';
import { DailyGuidance, GuidanceTask, HealthFlag, healthMessageKey, Slot, SLOTS } from './guidance';
import { Locale } from './household';

/** Resolves a Transloco key in the household locale (the client's Transloco, or the JSON on the server). */
export type Translate = (key: string, params?: Record<string, number | string>) => string;

/** What the logs say so far (H3/H4); empty until then. */
export interface TemplateProgress {
  masteredSkills?: readonly string[];
  socializedItems?: readonly string[];
  strugglingSkills?: readonly string[];
  toRepeatGently?: readonly string[];
}

export interface TemplateInput {
  date: IsoDate;
  dog: Dog;
  healthFlag?: HealthFlag;
  locale: Locale;
  progress?: TemplateProgress;
  translate: Translate;
}

const SESSION_MIN = 5;
const STRUGGLING_SESSION_MIN = 3;
const FALLBACK_SKILL = 'name';
/** Potty has its own schedule tasks; it never takes a training session. */
const NOT_A_SESSION_SKILL = 'potty';
const ALERT_SLOT: Slot = 'morning';

type Draft = Omit<GuidanceTask, 'id' | 'order'>;

const skillRank = (key: string): number => SKILLS.findIndex((skill) => skill.key === key);

/** The week's focus skills that fit a session, easiest first (catalog order). */
function sessionSkills(week: number): string[] {
  const skills = planWeek(week)
    .focusSkills.filter((key) => key !== NOT_A_SESSION_SKILL)
    .sort((a, b) => skillRank(a) - skillRank(b));
  return skills.length > 0 ? skills : [FALLBACK_SKILL];
}

function socializationItem(progress: TemplateProgress): string | undefined {
  const done = new Set(progress.socializedItems ?? []);
  const pending = [...SOCIALIZATION_ITEMS]
    .sort((a, b) => a.order - b.order)
    .find((item) => !done.has(item.key));
  return progress.toRepeatGently?.[0] ?? pending?.key;
}

const weekSinceArrival = (arrival: IsoDate, date: IsoDate): number =>
  Math.floor(-daysUntil(arrival, date) / 7) + 1;

const monthOf = (date: IsoDate): number => Number(date.slice(5, 7));

function alertApplies(alert: CareAlert, dog: Dog, date: IsoDate): boolean {
  const { environment, sleepsOutdoors } = alert.appliesTo;
  return (
    alert.months.includes(monthOf(date)) &&
    (environment === undefined || environment === dog.environment) &&
    (sleepsOutdoors === undefined || sleepsOutdoors === dog.sleepsOutdoors) &&
    (alert.arrivalWeek === undefined ||
      alert.arrivalWeek === weekSinceArrival(dog.arrivalDate, date))
  );
}

/**
 * The day's guidance built only from the bundled catalogs (`specs/04-guidance-engine.md`, "Template
 * fallback"): deterministic and offline. Shown while no stored guidance exists for the day.
 */
export function templateGuidance(input: TemplateInput): DailyGuidance {
  const { date, dog, locale, translate: t } = input;
  const progress = input.progress ?? {};
  const healthFlag = input.healthFlag ?? null;
  const skills = sessionSkills(dog.planWeek);
  const struggling = new Set(progress.strugglingSkills ?? []);
  const closingSkillKey = progress.masteredSkills?.[0] ?? FALLBACK_SKILL;
  const itemKey = socializationItem(progress);
  let session = 0;

  const training = (row: ScheduleRow): Draft => {
    const skillKey = skills[session++ % skills.length];
    return {
      closingSkillKey,
      durationMin: struggling.has(skillKey) ? STRUGGLING_SESSION_MIN : SESSION_MIN,
      instructions: t('guidance.template.trainingInstructions', {
        closing: t(`catalog.skills.${closingSkillKey}.name`),
        description: t(`catalog.skills.${skillKey}.description`),
      }),
      kind: 'training',
      skillKey,
      slot: row.slot,
      title: t('guidance.template.trainingTitle', { skill: t(`catalog.skills.${skillKey}.name`) }),
    };
  };

  const socialization = (row: ScheduleRow): Draft =>
    itemKey
      ? {
          durationMin: row.durationMin,
          instructions: t(`catalog.socialization.items.${itemKey}.howTo`),
          kind: 'socialization',
          slot: row.slot,
          socializationItemKey: itemKey,
          title: t('guidance.template.socializationTitle', {
            item: t(`catalog.socialization.items.${itemKey}.label`),
          }),
        }
      : scheduled(row);

  const scheduled = (row: ScheduleRow): Draft => ({
    durationMin: row.durationMin,
    instructions: t(`catalog.schedule.${row.id}.instructions`),
    kind: row.kind,
    ...(row.skillKey ? { skillKey: row.skillKey } : {}),
    slot: row.slot,
    title: t(`catalog.schedule.${row.id}.title`),
  });

  const builders: Partial<Record<ScheduleRow['kind'], (row: ScheduleRow) => Draft>> = {
    socialization,
    training,
  };

  const fromSchedule = SCHEDULE.filter((row) => row.isTask).map((row) =>
    (builders[row.kind] ?? scheduled)(row)
  );
  const alerts: Draft[] = CARE_ALERTS.filter((alert) => alertApplies(alert, dog, date)).map(
    (alert) => ({
      durationMin: null,
      instructions: t(`catalog.careAlerts.${alert.key}.message`),
      kind: 'care',
      slot: ALERT_SLOT,
      title: t(`catalog.careAlerts.${alert.key}.title`),
    })
  );

  // Stable sort keeps schedule order inside a slot; alerts close the morning.
  const tasks = [...fromSchedule, ...alerts]
    .map((task, position) => ({ position, task }))
    .sort(
      (a, b) => SLOTS.indexOf(a.task.slot) - SLOTS.indexOf(b.task.slot) || a.position - b.position
    )
    .map(({ task }, index): GuidanceTask => ({ ...task, id: `t${index + 1}`, order: index + 1 }));

  const week = planWeek(dog.planWeek).week;
  const healthKey = healthMessageKey(healthFlag);
  const objective = t(`catalog.planWeeks.week${week}.objective`);

  return {
    ageWeeks: ageInWeeks(dog.birthDate, date),
    date,
    healthFlag,
    locale,
    planWeek: week,
    source: 'template',
    summary: healthKey ? `${objective} ${t(healthKey)}` : objective,
    tasks,
  };
}
