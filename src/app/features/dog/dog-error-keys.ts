import { DogError } from '@domain/dog';

export type DogField = 'arrivalDate' | 'birthDate' | 'breed' | 'name' | 'notes';

/** Where each domain error is shown and which Transloco key explains it. */
export const DOG_ERRORS: Record<DogError, { field: DogField; key: string }> = {
  arrivalBeforeBirth: { field: 'arrivalDate', key: 'dog.errors.arrivalBeforeBirth' },
  arrivalDateInvalid: { field: 'arrivalDate', key: 'dog.errors.dateInvalid' },
  birthDateInFuture: { field: 'birthDate', key: 'dog.errors.birthDateInFuture' },
  birthDateInvalid: { field: 'birthDate', key: 'dog.errors.dateInvalid' },
  breedTooLong: { field: 'breed', key: 'dog.errors.breedTooLong' },
  nameRequired: { field: 'name', key: 'dog.errors.nameRequired' },
  nameTooLong: { field: 'name', key: 'dog.errors.nameTooLong' },
  notesTooLong: { field: 'notes', key: 'dog.errors.notesTooLong' },
};

/** First error per field, in the validator's order. */
export const errorsByField = (codes: readonly DogError[]): Partial<Record<DogField, string>> =>
  codes.reduce<Partial<Record<DogField, string>>>((byField, code) => {
    const { field, key } = DOG_ERRORS[code];
    return byField[field] ? byField : { ...byField, [field]: key };
  }, {});
