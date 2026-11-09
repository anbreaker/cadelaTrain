import { DEFAULT_ATTEMPTS, latestByTask, TaskLog, validateTaskLogDraft } from './task-log';

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

describe('validateTaskLogDraft', () => {
  it('should accept a training log with successes out of attempts (AC3.2)', () => {
    expect(validateTaskLogDraft('training', { attempts: 10, notes: '', successCount: 8 })).toEqual(
      []
    );
    expect(validateTaskLogDraft('training', { attempts: 1, notes: '', successCount: 0 })).toEqual(
      []
    );
  });

  it.each([
    [{ attempts: 0, successCount: 0 }, ['attemptsOutOfRange']],
    [{ attempts: 21, successCount: 0 }, ['attemptsOutOfRange']],
    [{ attempts: 10, successCount: 11 }, ['successCountOutOfRange']],
    [{ attempts: 10 }, ['successCountOutOfRange']],
    [{ attempts: 10, successCount: 2.5 }, ['successCountOutOfRange']],
  ])('should reject training %o (AC3.2)', (fields, errors) => {
    expect(validateTaskLogDraft('training', { notes: '', ...fields })).toEqual(errors);
  });

  it('should require a reaction for socialization (AC3.3)', () => {
    expect(validateTaskLogDraft('socialization', { notes: '' })).toEqual(['reactionRequired']);
    expect(validateTaskLogDraft('socialization', { notes: '', reaction: 'curious' })).toEqual([]);
  });

  it('should accept other kinds with notes only, up to 1000 characters (AC3.4)', () => {
    expect(validateTaskLogDraft('feeding', { notes: '' })).toEqual([]);
    expect(validateTaskLogDraft('care', { notes: 'a'.repeat(1000) })).toEqual([]);
    expect(validateTaskLogDraft('care', { notes: 'a'.repeat(1001) })).toEqual(['notesTooLong']);
  });

  it('should default training to 10 attempts (AC3.2)', () => {
    expect(DEFAULT_ATTEMPTS).toBe(10);
  });
});
