import { assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { ValidationFailedError } from '@data/data-errors';
import { LogEntry } from '@data/task-log.converter';
import { TaskLogRepository } from '@data/task-log.repository';
import { TaskLog } from '@domain/task-log';

import {
  createRulesEnvironment,
  dbAs,
  DOG_ID,
  DOG_PATH,
  HOUSEHOLD_ID,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seedHousehold,
} from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const DAY = '2026-12-12';

const training: LogEntry = {
  draft: { attempts: 10, notes: '', successCount: 8 },
  guidanceDate: DAY,
  task: { id: 't2', kind: 'training', skillKey: 'sit' },
};

const outing: LogEntry = {
  draft: { notes: 'Bien', reaction: 'curious' },
  guidanceDate: DAY,
  task: { id: 't4', kind: 'socialization', socializationItemKey: 'peopleMen' },
};

describe('TaskLogRepository writes on the emulator', () => {
  let env: RulesTestEnvironment;

  const repositoryAs = (user = MEMBER): TaskLogRepository =>
    repositoryFor(TaskLogRepository, dbAs(env, user));

  const count = async (name: string): Promise<number> =>
    (await getDocs(collection(dbAs(env, OWNER), `${DOG_PATH}/${name}`))).size;

  const socializationLog = async (id: string): Promise<Record<string, unknown> | undefined> =>
    (await getDoc(doc(dbAs(env, OWNER), `${DOG_PATH}/socializationLogs/${id}`))).data();

  const logsOfDay = (user = OWNER, length = 1): Promise<TaskLog[]> =>
    firstMatching(
      repositoryAs(user).watchDay(HOUSEHOLD_ID, DOG_ID, DAY),
      (logs) => logs.length === length
    );

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
    await seedHousehold(env);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should store a training result by the trainer at server time (AC3.1, AC3.2)', async () => {
    const id = await repositoryAs().log(HOUSEHOLD_ID, DOG_ID, training, MEMBER.uid);

    const [log] = await logsOfDay();

    expect(log).toMatchObject({
      attempts: 10,
      doneBy: MEMBER.uid,
      id,
      kind: 'training',
      skillKey: 'sit',
      successCount: 8,
      taskId: 't2',
    });
    expect(log.doneAt).toBeInstanceOf(Date);
  });

  it('should write the socialization checklist entry in the same batch (AC3.3)', async () => {
    const id = await repositoryAs().log(HOUSEHOLD_ID, DOG_ID, outing, MEMBER.uid);

    expect(await socializationLog(id)).toMatchObject({
      doneBy: MEMBER.uid,
      itemKey: 'peopleMen',
      notes: 'Bien',
      reaction: 'curious',
      taskLogId: id,
    });
  });

  it('should reject an invalid result and store nothing', async () => {
    const invalid = { ...training, draft: { attempts: 10, notes: '', successCount: 11 } };

    await expect(
      repositoryAs().log(HOUSEHOLD_ID, DOG_ID, invalid, MEMBER.uid)
    ).rejects.toBeInstanceOf(ValidationFailedError);
    expect(await count('taskLogs')).toBe(0);
  });

  it('should keep every completion of a task (AC3.5)', async () => {
    await repositoryAs(OWNER).log(HOUSEHOLD_ID, DOG_ID, training, OWNER.uid);
    await repositoryAs().log(HOUSEHOLD_ID, DOG_ID, training, MEMBER.uid);

    expect((await logsOfDay(OWNER, 2)).map((log) => log.doneBy).sort()).toEqual(
      [MEMBER.uid, OWNER.uid].sort()
    );
  });

  it('should let the author edit the result, both logs for socialization (AC3.6)', async () => {
    const id = await repositoryAs().log(HOUSEHOLD_ID, DOG_ID, outing, MEMBER.uid);

    await repositoryAs().update(
      HOUSEHOLD_ID,
      DOG_ID,
      { id, kind: 'socialization' },
      {
        notes: 'Mejor',
        reaction: 'calm',
      }
    );

    const [log] = await firstMatching(
      repositoryAs().watchDay(HOUSEHOLD_ID, DOG_ID, DAY),
      (logs) => logs[0]?.reaction === 'calm'
    );
    expect(log).toMatchObject({ doneBy: MEMBER.uid, notes: 'Mejor', reaction: 'calm' });
    expect(await socializationLog(id)).toMatchObject({ notes: 'Mejor', reaction: 'calm' });
  });

  it('should let the author delete the log, both logs for socialization (AC3.6)', async () => {
    const id = await repositoryAs().log(HOUSEHOLD_ID, DOG_ID, outing, MEMBER.uid);

    await repositoryAs().remove(HOUSEHOLD_ID, DOG_ID, { id, kind: 'socialization' });

    expect(await count('taskLogs')).toBe(0);
    expect(await socializationLog(id)).toBeUndefined();
  });

  it('should deny another member editing or deleting the log (AC3.6)', async () => {
    const id = await repositoryAs().log(HOUSEHOLD_ID, DOG_ID, training, MEMBER.uid);
    const owner = repositoryAs(OWNER);

    await assertFails(owner.update(HOUSEHOLD_ID, DOG_ID, { id, kind: 'training' }, training.draft));
    await assertFails(owner.remove(HOUSEHOLD_ID, DOG_ID, { id, kind: 'training' }));
  });

  it('should deny an outsider logging a task', async () => {
    await assertFails(repositoryAs(OUTSIDER).log(HOUSEHOLD_ID, DOG_ID, training, OUTSIDER.uid));
  });
});
