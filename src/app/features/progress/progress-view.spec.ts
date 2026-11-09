import { SKILLS } from '@domain/catalog';
import { TaskLog } from '@domain/task-log';

import { skillCards } from './progress-view';

const TODAY = '2026-12-20';

const training = (skillKey: string, successCount: number, attempts: number): TaskLog => ({
  attempts,
  doneAt: new Date(`${TODAY}T08:00:00Z`),
  doneBy: 'alice',
  guidanceDate: TODAY,
  id: `${skillKey}-${successCount}`,
  kind: 'training',
  notes: '',
  skillKey,
  successCount,
  taskId: 't1',
});

const formatDate = (date: string): string => `d:${date}`;

describe('skillCards', () => {
  it('should list every skill of the catalog in teaching order (AC4.1)', () => {
    const cards = skillCards([], TODAY, formatDate);

    expect(cards.map((card) => card.key)).toEqual(SKILLS.map((skill) => skill.key));
    expect(cards[1].nameKey).toBe('catalog.skills.sit.name');
  });

  it('should show the rate as a whole percentage and mark mastery (AC4.2, AC4.3)', () => {
    const [, sit, come] = skillCards(
      [training('sit', 8, 10), training('come', 2, 3)],
      TODAY,
      formatDate
    );

    expect(sit).toEqual(
      expect.objectContaining({
        mastered: true,
        ratePercent: 80,
        rateKey: 'progress.skills.rate',
        sessions: 1,
      })
    );
    expect(come).toEqual(
      expect.objectContaining({
        mastered: false,
        ratePercent: null,
        rateKey: 'progress.skills.noRate',
        sessions: 1,
      })
    );
  });

  it('should label every trend bar with its date, empty days included (AC4.2)', () => {
    const [, sit] = skillCards([training('sit', 7, 10)], TODAY, formatDate);
    const last = sit.trend[sit.trend.length - 1];

    expect(sit.trend).toHaveLength(14);
    expect(last).toEqual({ date: `d:${TODAY}`, labelKey: 'progress.skills.trendDay', percent: 70 });
    expect(sit.trend[0]).toEqual({
      date: 'd:2026-12-07',
      labelKey: 'progress.skills.trendDayEmpty',
      percent: null,
    });
  });

  it('should leave a skill never trained without sessions (AC4.2 empty state)', () => {
    const [name] = skillCards([], TODAY, formatDate);

    expect(name).toEqual(expect.objectContaining({ empty: true, ratePercent: null, sessions: 0 }));
  });
});
