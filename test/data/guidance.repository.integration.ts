import { firstValueFrom } from 'rxjs';
import { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { GuidanceRepository } from '@data/guidance.repository';
import { TaskLogRepository } from '@data/task-log.repository';

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
  seed,
  seedHousehold,
} from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { DocumentData, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const DAY = '2026-12-12';
const DONE_AT = new Date('2026-12-12T08:30:00Z');

const guidanceFixture = (): DocumentData => ({
  ageWeeks: 8,
  createdAt: Timestamp.now(),
  date: DAY,
  healthFlag: 'vet',
  locale: 'es',
  planWeek: 1,
  source: 'ai',
  status: 'ok',
  summary: 'Semana de llegada',
  tasks: [
    {
      durationMin: null,
      id: 't1',
      instructions: 'Ración de la mañana.',
      kind: 'feeding',
      order: 1,
      slot: 'morning',
      title: 'Desayuno',
    },
  ],
});

const logFixture = (guidanceDate: string, taskId: string): DocumentData => ({
  doneAt: Timestamp.fromDate(DONE_AT),
  doneBy: OWNER.uid,
  guidanceDate,
  kind: 'feeding',
  notes: '',
  taskId,
});

describe('GuidanceRepository and TaskLogRepository on the emulator', () => {
  let env: RulesTestEnvironment;

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

  it('should emit null while no guidance exists for the day (AC2.4 → template)', async () => {
    const guidance = repositoryFor(GuidanceRepository, dbAs(env, MEMBER));

    expect(await firstValueFrom(guidance.watchDay(HOUSEHOLD_ID, DOG_ID, DAY))).toBeNull();
  });

  it("should let a member read the day's stored guidance (AC2.1)", async () => {
    await seed(env, { [`${DOG_PATH}/dailyGuidance/${DAY}`]: guidanceFixture() });
    const guidance = repositoryFor(GuidanceRepository, dbAs(env, MEMBER));

    const day = await firstMatching(guidance.watchDay(HOUSEHOLD_ID, DOG_ID, DAY), Boolean);

    expect(day).toMatchObject({ date: DAY, healthFlag: 'vet', source: 'ai' });
    expect(day?.tasks.map((task) => task.id)).toEqual(['t1']);
  });

  it("should deny an outsider reading the household's guidance", async () => {
    await seed(env, { [`${DOG_PATH}/dailyGuidance/${DAY}`]: guidanceFixture() });
    const guidance = repositoryFor(GuidanceRepository, dbAs(env, OUTSIDER));

    await expect(firstValueFrom(guidance.watchDay(HOUSEHOLD_ID, DOG_ID, DAY))).rejects.toThrow();
  });

  it("should list only the day's task logs with who and when (AC2.3)", async () => {
    await seed(env, {
      [`${DOG_PATH}/taskLogs/today`]: logFixture(DAY, 't1'),
      [`${DOG_PATH}/taskLogs/yesterday`]: logFixture('2026-12-11', 't1'),
    });
    const logs = repositoryFor(TaskLogRepository, dbAs(env, MEMBER));

    const day = await firstMatching(
      logs.watchDay(HOUSEHOLD_ID, DOG_ID, DAY),
      (list) => list.length > 0
    );

    expect(day).toEqual([
      {
        doneAt: DONE_AT,
        doneBy: OWNER.uid,
        guidanceDate: DAY,
        id: 'today',
        kind: 'feeding',
        notes: '',
        taskId: 't1',
      },
    ]);
  });
});
