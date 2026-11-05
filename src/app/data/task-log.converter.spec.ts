import { InvalidDocumentError } from './data-errors';
import { parseTaskLog } from './task-log.converter';

import { Timestamp } from 'firebase/firestore';

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
  it('should read who did the task and when (AC2.3)', () => {
    expect(parseTaskLog('l1', PATH, stored())).toEqual({
      doneAt: DONE_AT,
      doneBy: 'alice',
      guidanceDate: '2026-12-12',
      id: 'l1',
      kind: 'training',
      notes: '',
      skillKey: 'sit',
      taskId: 't2',
    });
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
