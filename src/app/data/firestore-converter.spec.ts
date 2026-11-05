import { InvalidDocumentError } from './data-errors';
import { DocumentReader } from './document-reader';
import { readOnlyConverter, validDocs } from './firestore-converter';

import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

interface Named {
  id: string;
  name: string;
}

const converter = readOnlyConverter((id: string, path: string, data: DocumentData): Named => ({
  id,
  name: new DocumentReader(path, data).string('name'),
}));

/** Minimal stand-in: the converter only touches `id`, `ref.path` and `data()`. */
const rawSnapshot = (id: string, data: DocumentData): QueryDocumentSnapshot =>
  ({
    data: (): DocumentData => data,
    id,
    ref: { path: `things/${id}` },
  }) as unknown as QueryDocumentSnapshot;

const convertedSnapshot = (id: string, data: DocumentData): QueryDocumentSnapshot<Named> =>
  ({
    data: (): Named => converter.fromFirestore(rawSnapshot(id, data)),
  }) as unknown as QueryDocumentSnapshot<Named>;

describe('readOnlyConverter', () => {
  it('should map a valid document to the domain type with its id', () => {
    expect(converter.fromFirestore(rawSnapshot('a', { name: 'Dela' }))).toEqual({
      id: 'a',
      name: 'Dela',
    });
  });

  it('should reject a malformed document with a typed error', () => {
    expect(() => converter.fromFirestore(rawSnapshot('a', { name: 1 }))).toThrow(
      InvalidDocumentError
    );
  });

  it('should refuse to build write data, which needs explicit shapes', () => {
    expect(() => converter.toFirestore({ id: 'a', name: 'Dela' })).toThrow(/read-only/i);
  });
});

describe('validDocs', () => {
  it('should skip malformed documents and keep the valid ones in order', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation((): void => undefined);

    const docs = [
      convertedSnapshot('a', { name: 'A' }),
      convertedSnapshot('b', { name: 2 }),
      convertedSnapshot('c', { name: 'C' }),
    ];

    expect(validDocs(docs).map((item) => item.id)).toEqual(['a', 'c']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('should rethrow errors that are not about the document shape', () => {
    const broken = {
      data: (): never => {
        throw new TypeError('boom');
      },
    } as unknown as QueryDocumentSnapshot<Named>;

    expect(() => validDocs([broken])).toThrow(TypeError);
  });
});
