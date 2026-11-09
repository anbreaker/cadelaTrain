import { notesExport, notesExportFileName } from './notes-export';
import { SocializationLog, TaskLog } from './task-log';

const members = { alice: { displayName: 'Jéssica' }, bob: { displayName: 'Javier' } };

const sit: TaskLog = {
  attempts: 10,
  doneAt: new Date('2026-12-20T07:05:00Z'),
  doneBy: 'alice',
  guidanceDate: '2026-12-20',
  id: 'l1',
  kind: 'training',
  notes: 'Muy atenta, se sentó a la primera',
  skillKey: 'sit',
  successCount: 8,
  taskId: 'session1',
};

const lunch: TaskLog = {
  doneAt: new Date('2026-12-19T13:10:00Z'),
  doneBy: 'bob',
  guidanceDate: '2026-12-19',
  id: 'l2',
  kind: 'feeding',
  notes: '',
  taskId: 'lunch',
};

const grinder: SocializationLog = {
  doneAt: new Date('2026-12-19T16:30:00Z'),
  doneBy: 'bob',
  id: 's1',
  itemKey: 'peopleMen',
  notes: 'Se escondió detrás de mí',
  reaction: 'fear',
};

describe('notesExport', () => {
  const text = notesExport({
    dogName: 'Dela',
    logs: [lunch, sit],
    members,
    now: new Date('2026-12-20T09:00:00Z'),
    socialization: [grinder],
  });

  it('should head the file with the dog, the Madrid export time and the counts', () => {
    expect(text.split('\n')[0]).toBe('# Dela — training notes');
    expect(text).toContain(
      'Exported 2026-12-20 10:00 (Europe/Madrid) · 2 task logs · 1 socialization logs'
    );
  });

  it('should group by Madrid day, newest first, with who, what, result and the notes verbatim', () => {
    const newest = text.indexOf('## 2026-12-20');
    const older = text.indexOf('## 2026-12-19');

    expect(newest).toBeGreaterThan(0);
    expect(older).toBeGreaterThan(newest);
    expect(text).toContain(
      '- 08:05 · Jéssica · training · sit · Session 1: name and sit · 8/10 — Muy atenta, se sentó a la primera'
    );
    expect(text).toContain('- 14:10 · Javier · feeding · Lunch');
  });

  it('should list socialization with the item, the reaction and the notes', () => {
    expect(text).toContain(
      '- 17:30 · Javier · socialization · peopleMen (Men) · fear — Se escondió detrás de mí'
    );
  });

  it('should name an unknown author by uid instead of dropping the entry', () => {
    const orphan = notesExport({
      dogName: 'Dela',
      logs: [{ ...lunch, doneBy: 'gone' }],
      members,
      now: new Date('2026-12-20T09:00:00Z'),
      socialization: [],
    });

    expect(orphan).toContain('- 14:10 · gone · feeding · Lunch');
  });
});

describe('notesExportFileName', () => {
  it('should date the file in Madrid time', () => {
    expect(notesExportFileName('Dela', new Date('2026-12-31T23:30:00Z'))).toBe(
      'dela-notes-2027-01-01.md'
    );
  });
});
