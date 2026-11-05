import { InvalidDocumentError } from './data-errors';
import { parseDailyGuidance } from './guidance.converter';

const PATH = 'households/h1/dogs/d1/dailyGuidance/2026-12-12';

const stored = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ageWeeks: 8,
  createdAt: {},
  date: '2026-12-12',
  healthFlag: null,
  locale: 'es',
  planWeek: 1,
  source: 'ai',
  status: 'ok',
  summary: 'Semana de llegada',
  tasks: [
    {
      closingSkillKey: 'name',
      durationMin: 5,
      id: 't2',
      instructions: 'Di su nombre y premia.',
      kind: 'training',
      order: 2,
      skillKey: 'name',
      slot: 'morning',
      title: 'Entreno: nombre',
    },
    {
      durationMin: null,
      id: 't1',
      instructions: 'Ración de la mañana.',
      kind: 'feeding',
      order: 1,
      slot: 'morning',
      title: 'Desayuno',
    },
  ],
  ...overrides,
});

const failingField = (data: Record<string, unknown>): string => {
  try {
    parseDailyGuidance('2026-12-12', PATH, data);
  } catch (error) {
    if (error instanceof InvalidDocumentError) return error.field;
    throw error;
  }
  throw new Error('expected an InvalidDocumentError');
};

describe('parseDailyGuidance', () => {
  it('should read stored guidance with its tasks, omitting absent optional keys (AC2.1, AC2.2)', () => {
    const guidance = parseDailyGuidance('2026-12-12', PATH, stored());

    expect(guidance).toEqual({
      ageWeeks: 8,
      date: '2026-12-12',
      healthFlag: null,
      locale: 'es',
      planWeek: 1,
      source: 'ai',
      summary: 'Semana de llegada',
      tasks: [
        {
          closingSkillKey: 'name',
          durationMin: 5,
          id: 't2',
          instructions: 'Di su nombre y premia.',
          kind: 'training',
          order: 2,
          skillKey: 'name',
          slot: 'morning',
          title: 'Entreno: nombre',
        },
        {
          durationMin: null,
          id: 't1',
          instructions: 'Ración de la mañana.',
          kind: 'feeding',
          order: 1,
          slot: 'morning',
          title: 'Desayuno',
        },
      ],
    });
  });

  it('should read the health flag (AC2.6)', () => {
    expect(
      parseDailyGuidance('2026-12-12', PATH, stored({ healthFlag: 'urgent' })).healthFlag
    ).toBe('urgent');
  });

  it.each([
    ['tasks.0.slot', { tasks: [{ ...(stored()['tasks'] as object[])[0], slot: 'dawn' }] }],
    [
      'tasks.0.durationMin',
      { tasks: [{ ...(stored()['tasks'] as object[])[0], durationMin: 45 }] },
    ],
    ['tasks', { tasks: 'none' }],
    ['healthFlag', { healthFlag: 'maybe' }],
    ['source', { source: 'magic' }],
    ['date', { date: '12/12/2026' }],
  ])('should reject a malformed %s', (field, overrides) => {
    expect(failingField(stored(overrides))).toBe(field);
  });
});
