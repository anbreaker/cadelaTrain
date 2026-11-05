import { InvalidDocumentError } from './data-errors';
import { DocumentReader } from './document-reader';

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
});
