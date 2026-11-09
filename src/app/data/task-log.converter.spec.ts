import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import {
  newSocializationLogData,
  newTaskLogData,
  parseSocializationLog,
  parseTaskLog,
  taskLogResultData,
} from './task-log.converter';

import { serverTimestamp, Timestamp } from 'firebase/firestore';

const PATH = 'households/h1/dogs/d1/taskLogs/l1';
const DONE_AT = new Date('2026-12-12T08:30:00Z');

const stored = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  attempts: 10,
  doneAt: Timestamp.fromDate(DONE_AT),
  doneBy: 'alice',
  guidanceDate: '2026-12-12',
  kind: 'training',
  notes: '',
  skillKey: 'sit',
  successCount: 8,
  taskId: 't2',
  ...overrides,
});

describe('parseTaskLog', () => {
  it('should read who did the task and when, with the training result (AC2.3, AC3.2)', () => {
    expect(parseTaskLog('l1', PATH, stored())).toEqual({
      attempts: 10,
      doneAt: DONE_AT,
      doneBy: 'alice',
      guidanceDate: '2026-12-12',
      id: 'l1',
      kind: 'training',
      notes: '',
      skillKey: 'sit',
      successCount: 8,
      taskId: 't2',
    });
  });

  it('should read the reaction of a socialization log (AC3.3)', () => {
    const log = parseTaskLog('l1', PATH, {
      doneAt: Timestamp.fromDate(DONE_AT),
      doneBy: 'alice',
      guidanceDate: '2026-12-12',
      kind: 'socialization',
      notes: '',
      reaction: 'curious',
      taskId: 't4',
    });

    expect(log.reaction).toBe('curious');
    expect(log).not.toHaveProperty('attempts');
  });

  it('should leave skillKey out when the log has none', () => {
    const feeding = stored({ kind: 'feeding' });
    delete feeding['skillKey'];

    expect(parseTaskLog('l1', PATH, feeding)).not.toHaveProperty('skillKey');
  });

  it('should reject a log without a server time', () => {
    expect(() => parseTaskLog('l1', PATH, stored({ doneAt: null }))).toThrow(InvalidDocumentError);
  });
});

const training = { id: 't2', kind: 'training', skillKey: 'sit' } as const;
const outing = { id: 't4', kind: 'socialization', socializationItemKey: 'peopleMen' } as const;

describe('newTaskLogData (AC3.1–AC3.4)', () => {
  it('should store a training result authored now by the trainer', () => {
    expect(
      newTaskLogData(
        {
          draft: { attempts: 10, notes: ' Muy bien ', successCount: 8 },
          guidanceDate: '2026-12-12',
          task: training,
        },
        'alice'
      )
    ).toEqual({
      attempts: 10,
      doneAt: serverTimestamp(),
      doneBy: 'alice',
      guidanceDate: '2026-12-12',
      kind: 'training',
      notes: 'Muy bien',
      skillKey: 'sit',
      successCount: 8,
      taskId: 't2',
    });
  });

  it('should store only the reaction for socialization and nothing extra for other kinds', () => {
    const socialization = newTaskLogData(
      {
        draft: { notes: '', reaction: 'calm', successCount: 3 },
        guidanceDate: '2026-12-12',
        task: outing,
      },
      'alice'
    );
    const feeding = newTaskLogData(
      {
        draft: { attempts: 10, notes: '', reaction: 'calm' },
        guidanceDate: '2026-12-12',
        task: { id: 't1', kind: 'feeding' },
      },
      'alice'
    );

    expect(socialization).toMatchObject({ kind: 'socialization', reaction: 'calm' });
    expect(socialization).not.toHaveProperty('successCount');
    expect(Object.keys(feeding).sort()).toEqual(
      ['doneAt', 'doneBy', 'guidanceDate', 'kind', 'notes', 'taskId'].sort()
    );
  });

  it('should reject an invalid draft with its codes', () => {
    expect(() =>
      newTaskLogData(
        {
          draft: { attempts: 10, notes: '', successCount: 12 },
          guidanceDate: '2026-12-12',
          task: training,
        },
        'alice'
      )
    ).toThrow(new ValidationFailedError(['successCountOutOfRange']));
  });
});

describe('taskLogResultData (AC3.6)', () => {
  it('should update only the result fields of the task kind', () => {
    expect(taskLogResultData('training', { attempts: 5, notes: ' ok ', successCount: 5 })).toEqual({
      attempts: 5,
      notes: 'ok',
      successCount: 5,
    });
    expect(taskLogResultData('socialization', { notes: '', reaction: 'fear' })).toEqual({
      notes: '',
      reaction: 'fear',
    });
  });

  it('should reject an invalid edit', () => {
    expect(() => taskLogResultData('socialization', { notes: '' })).toThrow(ValidationFailedError);
  });
});

describe('newSocializationLogData (data model: both logs in one batch)', () => {
  it('should mirror the reaction and notes for the socialization checklist', () => {
    expect(
      newSocializationLogData('peopleMen', { notes: ' hola ', reaction: 'curious' }, 'alice', 'l1')
    ).toEqual({
      doneAt: serverTimestamp(),
      doneBy: 'alice',
      itemKey: 'peopleMen',
      notes: 'hola',
      reaction: 'curious',
      taskLogId: 'l1',
    });
  });
});

describe('parseSocializationLog (AC4.4)', () => {
  const SOCIAL_PATH = 'households/h1/dogs/d1/socializationLogs/l1';
  const social = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    doneAt: Timestamp.fromDate(DONE_AT),
    doneBy: 'alice',
    itemKey: 'peopleMen',
    notes: 'From far away',
    reaction: 'fear',
    taskLogId: 'l1',
    ...overrides,
  });

  it('should read the item, reaction, who and when', () => {
    expect(parseSocializationLog('l1', SOCIAL_PATH, social())).toEqual({
      doneAt: DONE_AT,
      doneBy: 'alice',
      id: 'l1',
      itemKey: 'peopleMen',
      notes: 'From far away',
      reaction: 'fear',
    });
  });

  it('should reject an unknown reaction', () => {
    expect(() => parseSocializationLog('l1', SOCIAL_PATH, social({ reaction: 'angry' }))).toThrow(
      InvalidDocumentError
    );
  });
});
