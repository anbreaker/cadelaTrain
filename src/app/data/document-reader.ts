import { InvalidDocumentError } from './data-errors';

import { DocumentData, Timestamp } from 'firebase/firestore';

type Guard<T> = (value: unknown) => value is T;

const isString: Guard<string> = (value): value is string => typeof value === 'string';
const isBoolean: Guard<boolean> = (value): value is boolean => typeof value === 'boolean';
const isMap: Guard<DocumentData> = (value): value is DocumentData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isMapArray: Guard<DocumentData[]> = (value): value is DocumentData[] =>
  Array.isArray(value) && value.every(isMap);
const isTimestamp: Guard<Timestamp> = (value): value is Timestamp => value instanceof Timestamp;
const isKey: Guard<string> = (value): value is string => isString(value) && value.length > 0;
const isAbsent = (value: unknown): boolean => value === undefined || value === null;
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

  /** An array of maps; each item reports its fields as `field.index.name`. */
  children(field: string): DocumentReader[] {
    return this.read(field, isMapArray).map(
      (item, index) => new DocumentReader(this.path, item, `${this.prefix}${field}.${index}.`)
    );
  }

  integer(field: string, min: number, max: number): number {
    const isInRange = (value: unknown): value is number =>
      Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
    return this.read(field, isInRange);
  }

  /** A required catalog key: a non-empty string. */
  key(field: string): string {
    return this.read(field, isKey);
  }

  keys(): string[] {
    return Object.keys(this.data);
  }

  /** `null` when the field is null or missing. */
  nullableInteger(field: string, min: number, max: number): null | number {
    return isAbsent(this.data[field]) ? null : this.integer(field, min, max);
  }

  /** `null` when the field is null or missing. */
  nullableOneOf<T extends string>(field: string, values: readonly T[]): null | T {
    return isAbsent(this.data[field]) ? null : this.oneOf(field, values);
  }

  oneOf<T extends string>(field: string, values: readonly T[]): T {
    const isValue = (value: unknown): value is T => values.some((allowed) => allowed === value);
    return this.read(field, isValue);
  }

  /** `undefined` when the field is missing. */
  optionalInteger(field: string, min: number, max: number): number | undefined {
    return this.data[field] === undefined ? undefined : this.integer(field, min, max);
  }

  /** An optional catalog key: `undefined` when missing, otherwise a non-empty string. */
  optionalKey(field: string): string | undefined {
    return this.data[field] === undefined ? undefined : this.read(field, isKey);
  }

  /** `undefined` when the field is missing. */
  optionalOneOf<T extends string>(field: string, values: readonly T[]): T | undefined {
    return this.data[field] === undefined ? undefined : this.oneOf(field, values);
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

  /** A server timestamp; pending local writes need `serverTimestamps: 'estimate'` to pass. */
  timestamp(field: string): Date {
    return this.read(field, isTimestamp).toDate();
  }

  private read<T>(field: string, guard: Guard<T>): T {
    const value: unknown = this.data[field];
    if (!guard(value)) throw new InvalidDocumentError(this.path, `${this.prefix}${field}`);
    return value;
  }
}
