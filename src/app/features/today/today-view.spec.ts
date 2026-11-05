import { DailyGuidance, GuidanceTask } from '@domain/guidance';
import { HouseholdMember } from '@domain/household';
import { TaskLog } from '@domain/task-log';

import { slotViews } from './today-view';

const task = (id: string, slot: GuidanceTask['slot'], order: number): GuidanceTask => ({
  durationMin: 5,
  id,
  instructions: `${id} instructions`,
  kind: 'training',
  order,
  slot,
  title: `${id} title`,
});

const guidance = (tasks: GuidanceTask[]): DailyGuidance => ({
  ageWeeks: 8,
  date: '2026-12-12',
  healthFlag: null,
  locale: 'es',
  planWeek: 1,
  source: 'template',
  summary: 'Summary',
  tasks,
});

const log = (taskId: string, doneBy: string, doneAt: string): TaskLog => ({
  doneAt: new Date(doneAt),
  doneBy,
  guidanceDate: '2026-12-12',
  id: `${taskId}-${doneAt}`,
  kind: 'training',
  notes: '',
  taskId,
});

const members: Record<string, HouseholdMember> = {
  alice: { displayName: 'Jéssica', role: 'owner' },
};

const time = (date: Date): string => date.toISOString().slice(11, 16);

describe('slotViews', () => {
  it('should group cards by slot in day order with the slot label key (AC2.1)', () => {
    const views = slotViews(
      guidance([task('t3', 'night', 3), task('t1', 'morning', 1), task('t2', 'morning', 2)]),
      [],
      members,
      time
    );

    expect(views.map((view) => view.labelKey)).toEqual(['slots.morning', 'slots.night']);
    expect(views[0].cards.map((card) => card.id)).toEqual(['t1', 't2']);
    expect(views[0].cards[0]).toEqual({
      done: null,
      durationMin: 5,
      id: 't1',
      instructions: 't1 instructions',
      kind: 'training',
      title: 't1 title',
    });
  });

  it('should mark done tasks with the member name and the time of the latest log (AC2.3)', () => {
    const [morning] = slotViews(
      guidance([task('t1', 'morning', 1)]),
      [log('t1', 'alice', '2026-12-12T08:00:00Z'), log('t1', 'alice', '2026-12-12T09:15:00Z')],
      members,
      time
    );

    expect(morning.cards[0].done).toEqual({ at: '09:15', by: 'Jéssica' });
  });

  it('should keep the time but no name when the author left the household', () => {
    const [morning] = slotViews(
      guidance([task('t1', 'morning', 1)]),
      [log('t1', 'gone', '2026-12-12T08:00:00Z')],
      members,
      time
    );

    expect(morning.cards[0].done).toEqual({ at: '08:00', by: null });
  });
});
