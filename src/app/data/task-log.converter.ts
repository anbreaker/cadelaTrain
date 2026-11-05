import { isIsoDate } from '@domain/dates';
import { TASK_KINDS } from '@domain/guidance';
import { TaskLog } from '@domain/task-log';

import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData } from 'firebase/firestore';

/** Reads who completed a task and when; H3 adds the training and socialization details. */
export const parseTaskLog = (id: string, path: string, data: DocumentData): TaskLog => {
  const reader = new DocumentReader(path, data);
  const skillKey = reader.optionalKey('skillKey');
  return {
    doneAt: reader.timestamp('doneAt'),
    doneBy: reader.string('doneBy'),
    guidanceDate: reader.stringWhere('guidanceDate', isIsoDate),
    id,
    kind: reader.oneOf('kind', TASK_KINDS),
    notes: reader.optionalString('notes'),
    ...(skillKey === undefined ? {} : { skillKey }),
    taskId: reader.string('taskId'),
  };
};

export const taskLogConverter = readOnlyConverter(parseTaskLog);
