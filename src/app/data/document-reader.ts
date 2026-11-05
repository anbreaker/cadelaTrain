import { InvalidDocumentError } from './data-errors';

import { DocumentData } from 'firebase/firestore';

type Guard<T> = (value: unknown) => value is T;

const isString: Guard<string> = (value): value is string => typeof value === 'string';
const isBoolean: Guard<boolean> = (value): value is boolean => typeof value === 'boolean';
const isMap: Guard<DocumentData> = (value): value is DocumentData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray: Guard<string[]> = (value): value is string[] =>
  Array.isArray(value) && value.every(isString);

/** Reads typed fields from raw document data, failing with the offending field instead of casting. */
export class DocumentReader {
  constructor(
    private readonly path: string,
    private readonly data: DocumentData,
    private readonly prefix = ''
  ) {}

  boolean(field: string): boolean {
    return this.read(field, isBoolean);
  }

  child(field: string): DocumentReader {
    return new DocumentReader(this.path, this.read(field, isMap), `${this.prefix}${field}.`);
  }

  integer(field: string, min: number, max: number): number {
    const isInRange = (value: unknown): value is number =>
      Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
    return this.read(field, isInRange);
  }

  keys(): string[] {
    return Object.keys(this.data);
  }

  oneOf<T extends string>(field: string, values: readonly T[]): T {
    const isValue = (value: unknown): value is T => values.some((allowed) => allowed === value);
    return this.read(field, isValue);
  }

  /** Optional strings are omitted by some writers; the domain models them as empty. */
  optionalString(field: string): string {
    return this.data[field] === undefined ? '' : this.string(field);
  }

  string(field: string): string {
    return this.read(field, isString);
  }

  stringArray(field: string): string[] {
    return this.read(field, isStringArray);
  }

  stringWhere(field: string, predicate: (value: string) => boolean): string {
    const isMatching = (value: unknown): value is string => isString(value) && predicate(value);
    return this.read(field, isMatching);
  }

  private read<T>(field: string, guard: Guard<T>): T {
    const value: unknown = this.data[field];
    if (!guard(value)) throw new InvalidDocumentError(this.path, `${this.prefix}${field}`);
    return value;
  }
}
