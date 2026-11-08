import { DailyGuidance, GuidanceTask } from '@domain/guidance';
import { HouseholdMember } from '@domain/household';
import { TaskLog } from '@domain/task-log';

import { DayContext, slotViews } from './today-view';

const task = (id: string, slot: GuidanceTask['slot'], order: number): GuidanceTask => ({
  durationMin: 5,
  id,
  instructions: `${id} instructions`,
  kind: 'training',
  order,
  skillKey: 'sit',
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
  attempts: 10,
  doneAt: new Date(doneAt),
  doneBy,
  guidanceDate: '2026-12-12',
  id: `${taskId}-${doneAt}`,
  kind: 'training',
  notes: 'ok',
  skillKey: 'sit',
  successCount: 7,
  taskId,
});

const members: Record<string, HouseholdMember> = {
  alice: { displayName: 'Jéssica', role: 'owner' },
  bob: { displayName: 'Javi', role: 'member' },
};

const context = (logs: TaskLog[], overrides: Partial<DayContext> = {}): DayContext => ({
  formatTime: (date) => date.toISOString().slice(11, 16),
  logs,
  members,
  now: new Date('2026-12-12T12:00:00Z'),
  uid: 'alice',
  ...overrides,
});

describe('slotViews', () => {
  it('should group cards by slot in day order with the slot label key (AC2.1)', () => {
    const views = slotViews(
      guidance([task('t3', 'night', 3), task('t1', 'morning', 1), task('t2', 'morning', 2)]),
      context([])
    );

    expect(views.map((view) => view.labelKey)).toEqual(['slots.morning', 'slots.night']);
    expect(views[0].cards.map((card) => card.view.id)).toEqual(['t1', 't2']);
    expect(views[0].cards[0]).toEqual({
      edit: null,
      task: { id: 't1', kind: 'training', skillKey: 'sit' },
      view: {
        canEdit: false,
        count: 0,
        done: null,
        durationMin: 5,
        id: 't1',
        instructions: 't1 instructions',
        kind: 'training',
        title: 't1 title',
      },
    });
  });

  it('should show the latest completion and the count (AC2.3, AC3.5)', () => {
    const [morning] = slotViews(
      guidance([task('t1', 'morning', 1)]),
      context([
        log('t1', 'bob', '2026-12-12T08:00:00Z'),
        log('t1', 'alice', '2026-12-12T09:15:00Z'),
      ])
    );

    expect(morning.cards[0].view).toMatchObject({
      count: 2,
      done: { at: '09:15', by: 'Jéssica' },
    });
  });

  it('should keep the time but no name when the author left the household', () => {
    const [morning] = slotViews(
      guidance([task('t1', 'morning', 1)]),
      context([log('t1', 'gone', '2026-12-12T08:00:00Z')])
    );

    expect(morning.cards[0].view.done).toEqual({ at: '08:00', by: null });
  });

  it('should let me edit my latest log within 24 hours, from its result (AC3.6)', () => {
    const latest = log('t1', 'alice', '2026-12-12T09:15:00Z');
    const [morning] = slotViews(guidance([task('t1', 'morning', 1)]), context([latest]));

    expect(morning.cards[0].view.canEdit).toBe(true);
    expect(morning.cards[0].edit).toEqual({
      draft: { attempts: 10, notes: 'ok', successCount: 7 },
      log: { id: latest.id, kind: 'training' },
    });
  });

  it.each([
    ['someone else wrote the latest log', context([log('t1', 'bob', '2026-12-12T09:15:00Z')])],
    [
      'my log is 24 hours old',
      context([log('t1', 'alice', '2026-12-12T09:15:00Z')], {
        now: new Date('2026-12-13T09:15:00Z'),
      }),
    ],
  ])('should not offer editing when %s (AC3.6)', (_reason, day) => {
    const [morning] = slotViews(guidance([task('t1', 'morning', 1)]), day);

    expect(morning.cards[0].view.canEdit).toBe(false);
    expect(morning.cards[0].edit).toBeNull();
  });
});
