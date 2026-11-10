import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import {
  newWeeklyReviewData,
  newWeightLogData,
  parseWeeklyReview,
} from './weekly-review.converter';

import { serverTimestamp, Timestamp } from 'firebase/firestore';

const PATH = 'households/h1/dogs/d1/weeklyReviews/2';
const UPDATED_AT = new Date('2026-12-18T19:00:00Z');

const stored = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  notes: 'Buena semana',
  updatedAt: Timestamp.fromDate(UPDATED_AT),
  updatedBy: 'alice',
  weekNumber: 2,
  weightKg: 9.4,
  ...overrides,
});

describe('parseWeeklyReview (AC5.3)', () => {
  it('should read the notes, the weight and who changed it last, and when', () => {
    expect(parseWeeklyReview('2', PATH, stored())).toEqual({
      notes: 'Buena semana',
      updatedAt: UPDATED_AT,
      updatedBy: 'alice',
      weekNumber: 2,
      weightKg: 9.4,
    });
  });

  it('should read a review without weight as weight null', () => {
    const { weightKg, ...withoutWeight } = stored();
    void weightKg;

    expect(parseWeeklyReview('2', PATH, withoutWeight).weightKg).toBeNull();
  });

  it('should read the notes of week 0, before the arrival', () => {
    const { weightKg, ...preparation } = stored({ weekNumber: 0 });
    void weightKg;

    expect(parseWeeklyReview('0', PATH, preparation)).toMatchObject({
      weekNumber: 0,
      weightKg: null,
    });
  });

  it('should reject a stored review with a weight out of range', () => {
    expect(() => parseWeeklyReview('2', PATH, stored({ weightKg: 0 }))).toThrow(
      InvalidDocumentError
    );
  });
});

describe('newWeeklyReviewData (AC5.3)', () => {
  it('should write exactly the fields the rules allow, the editor and the server time', () => {
    expect(newWeeklyReviewData(2, { notes: '  Buena semana ', weightKg: 9.4 }, 'alice')).toEqual({
      notes: 'Buena semana',
      updatedAt: serverTimestamp(),
      updatedBy: 'alice',
      weekNumber: 2,
      weightKg: 9.4,
    });
  });

  it('should leave the weight out when there is none', () => {
    expect(newWeeklyReviewData(2, { notes: '', weightKg: null }, 'alice')).not.toHaveProperty(
      'weightKg'
    );
  });

  it('should refuse an invalid draft before writing', () => {
    expect(() => newWeeklyReviewData(2, { notes: '', weightKg: 200 }, 'alice')).toThrow(
      ValidationFailedError
    );
  });
});

describe('newWeightLogData (AC5.3)', () => {
  it('should store the weight as a weight log by the editor at server time', () => {
    expect(newWeightLogData(9.4, '2026-12-18', 'alice')).toEqual({
      doneAt: serverTimestamp(),
      doneBy: 'alice',
      kg: 9.4,
      measuredOn: '2026-12-18',
    });
  });
});
