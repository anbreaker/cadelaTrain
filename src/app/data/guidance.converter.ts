import { isIsoDate } from '@domain/dates';
import { DailyGuidance, GuidanceSource, GuidanceTask, SLOTS, TASK_KINDS } from '@domain/guidance';
import { LOCALES } from '@domain/household';

import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData } from 'firebase/firestore';

const SOURCES: readonly GuidanceSource[] = ['ai', 'template'];
const HEALTH_FLAGS = ['urgent', 'vet'] as const;
const MAX_DURATION_MIN = 30;
const MAX_ORDER = 100;
const MAX_AGE_WEEKS = 520;

const OPTIONAL_TASK_KEYS = ['closingSkillKey', 'skillKey', 'socializationItemKey'] as const;

/** Optional keys stay absent instead of `undefined`, so the task equals what the server wrote. */
const optionalKeys = (reader: DocumentReader): Partial<GuidanceTask> =>
  Object.fromEntries(
    OPTIONAL_TASK_KEYS.flatMap((field) => {
      const value = reader.optionalKey(field);
      return value === undefined ? [] : [[field, value]];
    })
  );

const parseTask = (reader: DocumentReader): GuidanceTask => ({
  ...optionalKeys(reader),
  durationMin: reader.nullableInteger('durationMin', 0, MAX_DURATION_MIN),
  id: reader.string('id'),
  instructions: reader.string('instructions'),
  kind: reader.oneOf('kind', TASK_KINDS),
  order: reader.integer('order', 0, MAX_ORDER),
  slot: reader.oneOf('slot', SLOTS),
  title: reader.string('title'),
});

/** Server-written guidance of one Madrid date (`dailyGuidance/{date}`); the client never writes it. */
export const parseDailyGuidance = (
  _id: string,
  path: string,
  data: DocumentData
): DailyGuidance => {
  const reader = new DocumentReader(path, data);
  return {
    ageWeeks: reader.integer('ageWeeks', 0, MAX_AGE_WEEKS),
    date: reader.stringWhere('date', isIsoDate),
    healthFlag: reader.nullableOneOf('healthFlag', HEALTH_FLAGS),
    locale: reader.oneOf('locale', LOCALES),
    planWeek: reader.integer('planWeek', 1, 8),
    source: reader.oneOf('source', SOURCES),
    summary: reader.string('summary'),
    tasks: reader.children('tasks').map(parseTask),
  };
};

export const guidanceConverter = readOnlyConverter(parseDailyGuidance);
