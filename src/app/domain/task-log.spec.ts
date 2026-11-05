import { latestByTask, TaskLog } from './task-log';

const log = (id: string, taskId: string, doneAt: string): TaskLog => ({
  doneAt: new Date(doneAt),
  doneBy: 'alice',
  guidanceDate: '2026-12-12',
  id,
  kind: 'training',
  notes: '',
  taskId,
});

describe('latestByTask', () => {
  it('should keep the latest completion of each task (AC2.3)', () => {
    const done = latestByTask([
      log('a', 't1', '2026-12-12T08:00:00Z'),
      log('b', 't1', '2026-12-12T09:00:00Z'),
      log('c', 't2', '2026-12-12T07:00:00Z'),
    ]);

    expect(done.get('t1')?.id).toBe('b');
    expect(done.get('t2')?.id).toBe('c');
    expect(done.has('t3')).toBe(false);
  });
});
