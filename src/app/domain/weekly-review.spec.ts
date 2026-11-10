import { SocializationLog, TaskLog } from './task-log';
import {
  reviewWeek,
  reviewWeekOf,
  validateWeeklyReviewDraft,
  weeklySummary,
  WeeklySummaryInput,
} from './weekly-review';

const ARRIVAL = '2026-12-05';

const dela = { arrivalDate: ARRIVAL, birthDate: '2026-10-10', planWeek: 1 };

let sequence = 0;
const training = (
  skillKey: string,
  guidanceDate: string,
  successCount: number,
  attempts = 10
): TaskLog => ({
  attempts,
  doneAt: new Date(`${guidanceDate}T09:00:00Z`),
  doneBy: 'alice',
  guidanceDate,
  id: `t${++sequence}`,
  kind: 'training',
  notes: '',
  skillKey,
  successCount,
  taskId: 't3',
});

const outing = (
  itemKey: string,
  doneAt: string,
  reaction: SocializationLog['reaction']
): SocializationLog => ({
  doneAt: new Date(doneAt),
  doneBy: 'alice',
  id: `s${++sequence}`,
  itemKey,
  notes: '',
  reaction,
});

const input = (overrides: Partial<WeeklySummaryInput> = {}): WeeklySummaryInput => ({
  dog: dela,
  logs: [],
  socialization: [],
  today: '2026-12-20',
  week: 1,
  ...overrides,
});

describe('reviewWeekOf (AC5.1)', () => {
  it('should number weeks from the arrival day, seven days each', () => {
    expect(reviewWeekOf(ARRIVAL, '2026-12-05')).toBe(1);
    expect(reviewWeekOf(ARRIVAL, '2026-12-11')).toBe(1);
    expect(reviewWeekOf(ARRIVAL, '2026-12-12')).toBe(2);
    expect(reviewWeekOf(ARRIVAL, '2027-01-02')).toBe(5);
  });

  it('should have no week before the arrival', () => {
    expect(reviewWeekOf(ARRIVAL, '2026-12-04')).toBeNull();
  });
});

describe('reviewWeek (AC5.1)', () => {
  it('should span the arrival day plus six days, then the next seven', () => {
    expect(reviewWeek(ARRIVAL, 1)).toEqual({ end: '2026-12-11', number: 1, start: '2026-12-05' });
    expect(reviewWeek(ARRIVAL, 2)).toEqual({ end: '2026-12-18', number: 2, start: '2026-12-12' });
  });
});

describe('weeklySummary', () => {
  it('should show the age in weeks and the plan week with its objective key (AC5.1)', () => {
    const summary = weeklySummary(input());

    expect(summary.week).toEqual(reviewWeek(ARRIVAL, 1));
    expect(summary.ageWeeks).toBe(8);
    expect(summary.planWeek).toBe(1);
    expect(summary.objectiveKey).toBe('catalog.planWeeks.week1.objective');
  });

  it('should list skills at 80 % or more as doing well and under 50 % as struggling (AC5.2)', () => {
    const summary = weeklySummary(
      input({
        logs: [
          training('name', '2026-12-06', 9),
          training('sit', '2026-12-08', 4),
          training('come', '2026-12-09', 6),
          training('down', '2026-12-09', 2, 5),
        ],
      })
    );

    expect(summary.doesWell).toEqual(['name']);
    expect(summary.struggles).toEqual(['sit']);
  });

  it('should judge a past week by its own days, not by later logs (AC5.2)', () => {
    const summary = weeklySummary(
      input({
        logs: [training('sit', '2026-12-10', 9), training('sit', '2026-12-13', 2)],
        week: 1,
      })
    );

    expect(summary.doesWell).toEqual(['sit']);
  });

  it('should list socialization items first done that week, in catalog order (AC5.2)', () => {
    const summary = weeklySummary(
      input({
        socialization: [
          outing('noiseAngleGrinder', '2026-12-07T10:00:00Z', 'curious'),
          outing('peopleMen', '2026-12-06T10:00:00Z', 'calm'),
          outing('peopleMen', '2026-12-08T10:00:00Z', 'calm'),
          outing('animalPoultryLivestock', '2026-12-09T10:00:00Z', 'fear'),
          outing('noiseAngleGrinder', '2026-12-13T10:00:00Z', 'calm'),
        ],
        week: 1,
      })
    );

    expect(summary.newSocialization).toEqual(['peopleMen', 'noiseAngleGrinder']);
    expect(
      weeklySummary(
        input({
          socialization: [
            outing('peopleMen', '2026-12-06T10:00:00Z', 'calm'),
            outing('peopleMen', '2026-12-13T10:00:00Z', 'calm'),
          ],
          week: 2,
        })
      ).newSocialization
    ).toEqual([]);
  });

  it('should date socialization by the Madrid day, not UTC (AC5.2)', () => {
    const lateNight = [outing('peopleMen', '2026-12-11T23:30:00Z', 'calm')];

    expect(weeklySummary(input({ socialization: lateNight, week: 1 })).newSocialization).toEqual(
      []
    );
    expect(weeklySummary(input({ socialization: lateNight, week: 2 })).newSocialization).toEqual([
      'peopleMen',
    ]);
  });

  it('should replay the plan week of a past week from its logs, never above the stored week', () => {
    const mastered = [training('name', '2026-12-06', 9)];

    expect(
      weeklySummary(input({ dog: { ...dela, planWeek: 2 }, logs: mastered, week: 2 })).planWeek
    ).toBe(2);
    expect(weeklySummary(input({ dog: dela, logs: mastered, week: 2 })).planWeek).toBe(1);
  });

  it('should use the stored plan week and today for the week in progress', () => {
    const summary = weeklySummary(
      input({ dog: { ...dela, planWeek: 2 }, today: '2026-12-14', week: 2 })
    );

    expect(summary.planWeek).toBe(2);
    expect(summary.ageWeeks).toBe(9);
  });
});

describe('validateWeeklyReviewDraft (AC5.3)', () => {
  it('should accept free notes and an optional weight in kg', () => {
    expect(validateWeeklyReviewDraft({ notes: 'Buena semana', weightKg: 9.4 })).toEqual([]);
    expect(validateWeeklyReviewDraft({ notes: '', weightKg: null })).toEqual([]);
  });

  it('should reject notes over 2000 characters and a weight outside 0.5–100 kg', () => {
    expect(validateWeeklyReviewDraft({ notes: 'a'.repeat(2001), weightKg: 0.4 })).toEqual([
      'notesTooLong',
      'weightOutOfRange',
    ]);
    expect(validateWeeklyReviewDraft({ notes: '', weightKg: 100.5 })).toEqual(['weightOutOfRange']);
  });
});
