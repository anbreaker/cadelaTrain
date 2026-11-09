import { DogDraft } from '@domain/dog';

import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import { dogUpdateData, newDogData, parseDog, planWeekUpdateData } from './dog.converter';

import { serverTimestamp } from 'firebase/firestore';

const TODAY = '2026-11-04';

const draft: DogDraft = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: ' Labrador ',
  environment: 'rural',
  name: ' Dela ',
  notes: '',
  sleepsOutdoors: true,
};

const DRAFT_KEYS = [
  'arrivalDate',
  'birthDate',
  'breed',
  'environment',
  'name',
  'notes',
  'sleepsOutdoors',
];

describe('newDogData (AC1.5)', () => {
  it('should store the trimmed draft at plan week 1 with server timestamps', () => {
    const data = newDogData(draft, TODAY);

    expect(Object.keys(data).sort()).toEqual(
      [...DRAFT_KEYS, 'createdAt', 'planWeek', 'updatedAt'].sort()
    );
    expect(data).toMatchObject({ breed: 'Labrador', name: 'Dela', planWeek: 1 });
    expect(data.createdAt.isEqual(serverTimestamp())).toBe(true);
    expect(data.updatedAt.isEqual(serverTimestamp())).toBe(true);
  });

  it('should reject an invalid draft with the domain error codes', () => {
    const invalid = { ...draft, arrivalDate: '2026-10-01' };

    expect(() => newDogData(invalid, TODAY)).toThrow(ValidationFailedError);
  });
});

describe('dogUpdateData', () => {
  it('should leave planWeek and createdAt out so the stored values are kept', () => {
    const data = dogUpdateData(draft, TODAY);

    expect(Object.keys(data).sort()).toEqual([...DRAFT_KEYS, 'updatedAt'].sort());
  });

  it('should reject a birth date in the future', () => {
    expect(() => dogUpdateData({ ...draft, birthDate: '2026-11-05' }, TODAY)).toThrow(
      ValidationFailedError
    );
  });
});

describe('planWeekUpdateData', () => {
  it('should write only the plan week and the server time', () => {
    expect(planWeekUpdateData(3)).toEqual({ planWeek: 3, updatedAt: serverTimestamp() });
  });

  it('should reject a week outside the 8-week plan', () => {
    expect(() => planWeekUpdateData(9)).toThrow(ValidationFailedError);
    expect(() => planWeekUpdateData(0)).toThrow(ValidationFailedError);
    expect(() => planWeekUpdateData(1.5)).toThrow(ValidationFailedError);
  });
});

describe('parseDog', () => {
  const stored = {
    arrivalDate: '2026-12-10',
    birthDate: '2026-10-15',
    createdAt: null,
    environment: 'urban',
    name: 'Dela',
    planWeek: 2,
    sleepsOutdoors: false,
    updatedAt: null,
  };

  it('should map a stored dog, defaulting the optional breed and notes', () => {
    expect(parseDog('d1', 'households/h1/dogs/d1', stored)).toEqual({
      arrivalDate: '2026-12-10',
      birthDate: '2026-10-15',
      breed: '',
      environment: 'urban',
      id: 'd1',
      name: 'Dela',
      notes: '',
      planWeek: 2,
      sleepsOutdoors: false,
    });
  });

  it.each([
    ['an impossible date', { birthDate: '2026-02-30' }],
    ['a plan week out of range', { planWeek: 9 }],
    ['an unknown environment', { environment: 'forest' }],
  ])('should reject %s', (_label, change) => {
    expect(() => parseDog('d1', 'households/h1/dogs/d1', { ...stored, ...change })).toThrow(
      InvalidDocumentError
    );
  });
});
