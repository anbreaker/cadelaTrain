import { addDays } from './dates';
import { skillProgress, skillRate } from './progress';
import { TaskLog } from './task-log';

const TODAY = '2026-12-20';

let sequence = 0;
const training = (
  guidanceDate: string,
  successCount: number,
  attempts: number,
  skillKey = 'sit'
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

describe('addDays', () => {
  it('should move a Madrid date across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('skillRate', () => {
  it('should use the newest whole logs until they reach 10 attempts', () => {
    const logs = [
      training('2026-12-14', 0, 10),
      training('2026-12-19', 6, 6),
      training('2026-12-20', 2, 4),
    ];

    expect(skillRate(logs, 'sit', TODAY)).toBe(0.8);
  });

  it('should never split a log that passes 10 attempts', () => {
    const logs = [training('2026-12-19', 0, 10), training('2026-12-20', 4, 4)];

    expect(skillRate(logs, 'sit', TODAY)).toBeCloseTo(4 / 14);
  });

  it('should be null with fewer than 10 attempts in the last 7 days', () => {
    const logs = [training('2026-12-13', 10, 10), training('2026-12-20', 9, 9)];

    expect(skillRate(logs, 'sit', TODAY)).toBeNull();
  });

  it('should ignore other skills and non-training logs', () => {
    const walk: TaskLog = { ...training(TODAY, 0, 10), kind: 'potty' };
    const logs = [training(TODAY, 10, 10), training(TODAY, 0, 10, 'come'), walk];

    expect(skillRate(logs, 'sit', TODAY)).toBe(1);
  });
});

describe('skillProgress', () => {
  it('should mark a skill at 80 % or more as mastered (AC4.3)', () => {
    expect(skillProgress([training(TODAY, 8, 10)], 'sit', TODAY).mastered).toBe(true);
    expect(skillProgress([training(TODAY, 7, 10)], 'sit', TODAY).mastered).toBe(false);
  });

  it('should count every training log of the skill as a session (AC4.2)', () => {
    const logs = [
      training('2026-11-01', 1, 2),
      training(TODAY, 3, 4),
      training(TODAY, 1, 1, 'come'),
    ];

    expect(skillProgress(logs, 'sit', TODAY).sessions).toBe(2);
  });

  it('should give one trend point per day for the last 14 days, oldest first (AC4.2)', () => {
    const logs = [
      training('2026-12-06', 0, 10),
      training('2026-12-07', 2, 4),
      training('2026-12-20', 3, 4),
      training('2026-12-20', 5, 6),
    ];
    const { trend } = skillProgress(logs, 'sit', TODAY);

    expect(trend).toHaveLength(14);
    expect(trend[0]).toEqual({ date: '2026-12-07', rate: 0.5 });
    expect(trend[1]).toEqual({ date: '2026-12-08', rate: null });
    expect(trend[13]).toEqual({ date: TODAY, rate: 0.8 });
  });

  it('should report no data for a skill never trained (AC4.2 empty state)', () => {
    expect(skillProgress([], 'sit', TODAY)).toEqual(
      expect.objectContaining({ mastered: false, rate: null, sessions: 0 })
    );
  });
});
