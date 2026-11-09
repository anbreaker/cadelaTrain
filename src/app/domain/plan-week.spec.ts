import { planWeekFor, weekAdvance } from './plan-week';
import { TaskLog } from './task-log';

const TODAY = '2026-12-20';
/** 9 weeks old on TODAY: the age cap allows plan week 2 at most. */
const NINE_WEEKS = '2026-10-15';
/** 20 weeks old on TODAY: the age cap no longer limits the 8-week plan. */
const TWENTY_WEEKS = '2026-08-02';

let sequence = 0;
const training = (
  skillKey: string,
  successCount: number,
  attempts: number,
  guidanceDate = TODAY
): TaskLog => {
  sequence += 1;
  return {
    attempts,
    doneAt: new Date(`${guidanceDate}T08:00:00Z`),
    doneBy: 'alice',
    guidanceDate,
    id: `log${sequence}`,
    kind: 'training',
    notes: '',
    skillKey,
    successCount,
    taskId: `t${sequence}`,
  };
};

describe('planWeekFor', () => {
  const week1 = (logs: TaskLog[], birthDate = NINE_WEEKS): number =>
    planWeekFor({ birthDate, logs, planWeek: 1, today: TODAY });

  it('should stay while a key skill is below 0.8', () => {
    expect(week1([training('name', 7, 10)])).toBe(1);
  });

  it('should advance at exactly 0.8 with 10 attempts', () => {
    expect(week1([training('name', 8, 10)])).toBe(2);
  });

  it('should stay with fewer than 10 attempts in the last 7 days, however good', () => {
    expect(week1([training('name', 9, 9), training('name', 10, 10, '2026-12-13')])).toBe(1);
  });

  it('should ignore skills that are not key skills of the current week', () => {
    expect(week1([training('sit', 10, 10)])).toBe(1);
  });

  it('should hold the week while the age cap does not allow the next one', () => {
    const logs = [training('sit', 10, 10)];

    expect(planWeekFor({ birthDate: NINE_WEEKS, logs, planWeek: 2, today: TODAY })).toBe(2);
    expect(planWeekFor({ birthDate: TWENTY_WEEKS, logs, planWeek: 2, today: TODAY })).toBe(3);
  });

  it('should require every key skill of the week', () => {
    const logs = [training('come', 10, 10), training('sit', 10, 10), training('stay', 7, 10)];

    expect(weekAdvance({ birthDate: TWENTY_WEEKS, logs, planWeek: 8, today: TODAY })).toMatchObject(
      {
        keySkills: [
          { met: true, skillKey: 'come' },
          { met: true, skillKey: 'sit' },
          { met: false, skillKey: 'stay' },
        ],
      }
    );
  });

  it('should never go past week 8', () => {
    const logs = ['come', 'sit', 'stay'].map((key) => training(key, 10, 10));

    expect(planWeekFor({ birthDate: TWENTY_WEEKS, logs, planWeek: 8, today: TODAY })).toBe(8);
  });

  it('should never go back, even above the age cap or without logs', () => {
    expect(planWeekFor({ birthDate: NINE_WEEKS, logs: [], planWeek: 5, today: TODAY })).toBe(5);
  });
});

describe('weekAdvance', () => {
  it('should report each key skill with its rate and attempts of the last 7 days', () => {
    const logs = [training('name', 6, 8)];

    expect(weekAdvance({ birthDate: NINE_WEEKS, logs, planWeek: 1, today: TODAY })).toEqual({
      ageAllows: true,
      keySkills: [{ attempts: 8, met: false, rate: null, skillKey: 'name' }],
      minAgeWeeks: 9,
      nextWeek: 2,
    });
  });

  it('should give the age in weeks from which the next week is allowed', () => {
    const advance = weekAdvance({ birthDate: NINE_WEEKS, logs: [], planWeek: 2, today: TODAY });

    expect(advance).toMatchObject({ ageAllows: false, minAgeWeeks: 10, nextWeek: 3 });
  });

  it('should have no next week at week 8', () => {
    const advance = weekAdvance({ birthDate: TWENTY_WEEKS, logs: [], planWeek: 8, today: TODAY });

    expect(advance).toMatchObject({ ageAllows: false, minAgeWeeks: null, nextWeek: null });
  });
});
