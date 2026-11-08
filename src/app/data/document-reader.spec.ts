import { InvalidDocumentError } from './data-errors';
import { DocumentReader } from './document-reader';

import { Timestamp } from 'firebase/firestore';

const PATH = 'households/h1';

const readerOf = (data: Record<string, unknown>): DocumentReader => new DocumentReader(PATH, data);

const failingField = (read: () => unknown): string => {
  try {
    read();
  } catch (error) {
    if (error instanceof InvalidDocumentError) return `${error.path}:${error.field}`;
    throw error;
  }
  throw new Error('expected an InvalidDocumentError');
};

describe('DocumentReader', () => {
  it('should read fields of the expected type', () => {
    const reader = readerOf({ count: 3, flag: true, ids: ['a', 'b'], kind: 'rural', name: 'Dela' });

    expect(reader.string('name')).toBe('Dela');
    expect(reader.boolean('flag')).toBe(true);
    expect(reader.integer('count', 1, 8)).toBe(3);
    expect(reader.oneOf('kind', ['rural', 'urban'])).toBe('rural');
    expect(reader.stringArray('ids')).toEqual(['a', 'b']);
  });

  it('should default a missing optional string to empty and still type-check a present one', () => {
    expect(readerOf({}).optionalString('notes')).toBe('');
    expect(failingField(() => readerOf({ notes: 4 }).optionalString('notes'))).toBe(
      `${PATH}:notes`
    );
  });

  it.each([
    ['string', (reader: DocumentReader): unknown => reader.string('value'), { value: 1 }],
    ['boolean', (reader: DocumentReader): unknown => reader.boolean('value'), { value: 'true' }],
    ['integer', (reader: DocumentReader): unknown => reader.integer('value', 1, 8), { value: 1.5 }],
    [
      'integer range',
      (reader: DocumentReader): unknown => reader.integer('value', 1, 8),
      { value: 9 },
    ],
    ['enum', (reader: DocumentReader): unknown => reader.oneOf('value', ['a']), { value: 'b' }],
    [
      'string array',
      (reader: DocumentReader): unknown => reader.stringArray('value'),
      { value: ['a', 1] },
    ],
    ['missing field', (reader: DocumentReader): unknown => reader.string('value'), {}],
  ])('should name the field when a %s check fails', (_label, read, data) => {
    expect(failingField(() => read(readerOf(data)))).toBe(`${PATH}:value`);
  });

  it('should read nested maps and report the dotted field on failure', () => {
    const members = readerOf({ members: { alice: { role: 'boss' } } }).child('members');

    expect(members.keys()).toEqual(['alice']);
    expect(failingField(() => members.child('alice').oneOf('role', ['owner']))).toBe(
      `${PATH}:members.alice.role`
    );
    expect(failingField(() => readerOf({ members: ['x'] }).child('members'))).toBe(
      `${PATH}:members`
    );
  });

  it('should validate a string with a predicate', () => {
    const isShort = (value: string): boolean => value.length < 3;

    expect(readerOf({ value: 'ab' }).stringWhere('value', isShort)).toBe('ab');
    expect(failingField(() => readerOf({ value: 'abc' }).stringWhere('value', isShort))).toBe(
      `${PATH}:value`
    );
  });

  it('should read an array of maps, reporting the indexed field on failure', () => {
    const tasks = readerOf({ tasks: [{ id: 't1' }, { id: 2 }] }).children('tasks');

    expect(tasks[0].string('id')).toBe('t1');
    expect(failingField(() => tasks[1].string('id'))).toBe(`${PATH}:tasks.1.id`);
    expect(failingField(() => readerOf({ tasks: [1] }).children('tasks'))).toBe(`${PATH}:tasks`);
    expect(failingField(() => readerOf({ tasks: {} }).children('tasks'))).toBe(`${PATH}:tasks`);
  });

  it('should read null or a missing field as null in nullable readers', () => {
    const reader = readerOf({ flag: null, minutes: 5 });

    expect(reader.nullableOneOf('flag', ['vet'])).toBeNull();
    expect(reader.nullableOneOf('missing', ['vet'])).toBeNull();
    expect(readerOf({ flag: 'vet' }).nullableOneOf('flag', ['vet'])).toBe('vet');
    expect(failingField(() => readerOf({ flag: 'x' }).nullableOneOf('flag', ['vet']))).toBe(
      `${PATH}:flag`
    );
    expect(reader.nullableInteger('minutes', 0, 30)).toBe(5);
    expect(reader.nullableInteger('missing', 0, 30)).toBeNull();
    expect(failingField(() => readerOf({ value: 31 }).nullableInteger('value', 0, 30))).toBe(
      `${PATH}:value`
    );
  });

  it('should leave a missing optional key undefined and type-check a present one', () => {
    expect(readerOf({}).optionalKey('skillKey')).toBeUndefined();
    expect(readerOf({ skillKey: 'sit' }).optionalKey('skillKey')).toBe('sit');
    expect(failingField(() => readerOf({ skillKey: '' }).optionalKey('skillKey'))).toBe(
      `${PATH}:skillKey`
    );
  });

  it('should read a timestamp as a date', () => {
    const at = new Date('2026-12-12T08:30:00Z');

    expect(readerOf({ doneAt: Timestamp.fromDate(at) }).timestamp('doneAt')).toEqual(at);
    expect(failingField(() => readerOf({ doneAt: '2026-12-12' }).timestamp('doneAt'))).toBe(
      `${PATH}:doneAt`
    );
  });

  it('should leave a missing optional integer or enum undefined and type-check a present one', () => {
    expect(readerOf({}).optionalInteger('attempts', 1, 20)).toBeUndefined();
    expect(readerOf({ attempts: 10 }).optionalInteger('attempts', 1, 20)).toBe(10);
    expect(failingField(() => readerOf({ value: 0 }).optionalInteger('value', 1, 20))).toBe(
      `${PATH}:value`
    );
    expect(readerOf({}).optionalOneOf('reaction', ['calm'])).toBeUndefined();
    expect(failingField(() => readerOf({ value: 'x' }).optionalOneOf('value', ['calm']))).toBe(
      `${PATH}:value`
    );
  });
});
