import { isIsoDate, IsoDate } from '@domain/dates';
import { Dog, DogDraft, Environment, validateDogDraft } from '@domain/dog';

import { ValidationFailedError } from './data-errors';
import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData, FieldValue, serverTimestamp } from 'firebase/firestore';

const ENVIRONMENTS: readonly Environment[] = ['rural', 'urban'];
const FIRST_PLAN_WEEK = 1;
const LAST_PLAN_WEEK = 8;

export type DogUpdateData = DogDraft & { updatedAt: FieldValue };

export type NewDogData = DogUpdateData & { createdAt: FieldValue; planWeek: number };

const dogFields = (draft: DogDraft, today: IsoDate): DogDraft => {
  const errors = validateDogDraft(draft, today);
  if (errors.length > 0) throw new ValidationFailedError(errors);
  return {
    arrivalDate: draft.arrivalDate,
    birthDate: draft.birthDate,
    breed: draft.breed.trim(),
    environment: draft.environment,
    name: draft.name.trim(),
    notes: draft.notes.trim(),
    sleepsOutdoors: draft.sleepsOutdoors,
  };
};

export const newDogData = (draft: DogDraft, today: IsoDate): NewDogData => ({
  ...dogFields(draft, today),
  createdAt: serverTimestamp(),
  planWeek: FIRST_PLAN_WEEK,
  updatedAt: serverTimestamp(),
});

/** Leaves `planWeek` (server-owned) and `createdAt` out, so a partial update keeps them. */
export const dogUpdateData = (draft: DogDraft, today: IsoDate): DogUpdateData => ({
  ...dogFields(draft, today),
  updatedAt: serverTimestamp(),
});

export const parseDog = (id: string, path: string, data: DocumentData): Dog => {
  const reader = new DocumentReader(path, data);
  return {
    arrivalDate: reader.stringWhere('arrivalDate', isIsoDate),
    birthDate: reader.stringWhere('birthDate', isIsoDate),
    breed: reader.optionalString('breed'),
    environment: reader.oneOf('environment', ENVIRONMENTS),
    id,
    name: reader.string('name'),
    notes: reader.optionalString('notes'),
    planWeek: reader.integer('planWeek', FIRST_PLAN_WEEK, LAST_PLAN_WEEK),
    sleepsOutdoors: reader.boolean('sleepsOutdoors'),
  };
};

export const dogConverter = readOnlyConverter(parseDog);
