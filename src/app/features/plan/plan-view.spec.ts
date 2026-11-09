import { PLAN_WEEKS } from '@domain/catalog';
import { DailyGuidance } from '@domain/guidance';

import { planWeekViews, typicalDay, weekStart } from './plan-view';

const guidance: DailyGuidance = {
  ageWeeks: 8,
  date: '2026-12-10',
  healthFlag: null,
  locale: 'es',
  planWeek: 1,
  source: 'template',
  summary: 'Summary',
  tasks: [
    {
      durationMin: 5,
      id: 't2',
      instructions: 'Evening session',
      kind: 'training',
      order: 2,
      skillKey: 'name',
      slot: 'night',
      title: 'Night task',
    },
    {
      durationMin: null,
      id: 't1',
      instructions: 'Breakfast',
      kind: 'feeding',
      order: 1,
      slot: 'morning',
      title: 'Morning task',
    },
  ],
};

describe('planWeekViews', () => {
  it('should list the eight plan weeks in order with their ages and text keys', () => {
    const weeks = planWeekViews(1);

    expect(weeks.map((week) => week.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(weeks).toHaveLength(PLAN_WEEKS.length);
    expect(weeks[0]).toMatchObject({
      ages: { from: 8, to: 9 },
      howKey: 'catalog.planWeeks.week1.how',
      objectiveKey: 'catalog.planWeeks.week1.objective',
      readyWhenKey: 'catalog.planWeeks.week1.readyWhen',
    });
    expect(weeks[7].ages).toEqual({ from: 15, to: 16 });
  });

  it('should give each key skill its name and cue keys', () => {
    const week8 = planWeekViews(1)[7];

    expect(week8.keySkills).toEqual([
      { cueKey: 'catalog.skills.come.cue', key: 'come', nameKey: 'catalog.skills.come.name' },
      { cueKey: 'catalog.skills.sit.cue', key: 'sit', nameKey: 'catalog.skills.sit.name' },
      { cueKey: 'catalog.skills.stay.cue', key: 'stay', nameKey: 'catalog.skills.stay.name' },
    ]);
  });

  it('should mark only the current week, clamped to the plan range', () => {
    expect(
      planWeekViews(3)
        .filter((week) => week.current)
        .map((week) => week.week)
    ).toEqual([3]);
    expect(
      planWeekViews(12)
        .filter((week) => week.current)
        .map((week) => week.week)
    ).toEqual([8]);
  });
});

describe('weekStart', () => {
  it('should return the first day of a plan week counted from the arrival date', () => {
    expect(weekStart('2026-12-10', 1)).toBe('2026-12-10');
    expect(weekStart('2026-12-10', 3)).toBe('2026-12-24');
  });
});

describe('typicalDay', () => {
  it('should group the tasks by slot as read-only cards with no completions', () => {
    const slots = typicalDay(guidance);

    expect(slots.map((slot) => slot.slot)).toEqual(['morning', 'night']);
    expect(slots[0].labelKey).toBe('slots.morning');
    expect(slots[0].cards[0].view).toMatchObject({
      canEdit: false,
      count: 0,
      done: null,
      title: 'Morning task',
    });
  });
});
