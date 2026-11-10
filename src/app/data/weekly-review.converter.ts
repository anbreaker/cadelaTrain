import { IsoDate } from '@domain/dates';
import {
  PREPARATION_WEEK,
  REVIEW_NOTES_MAX,
  validateWeeklyReviewDraft,
  WeeklyReview,
  WeeklyReviewDraft,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from '@domain/weekly-review';

import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData, FieldValue, serverTimestamp } from 'firebase/firestore';

/** Exactly what `isWeeklyReview` in the rules accepts. */
export interface NewWeeklyReviewData {
  notes: string;
  updatedAt: FieldValue;
  updatedBy: string;
  weekNumber: number;
  weightKg?: number;
}

/** Exactly what `isWeightLog` in the rules accepts. */
export interface NewWeightLogData {
  doneAt: FieldValue;
  doneBy: string;
  kg: number;
  measuredOn: IsoDate;
}

/** The review as `uid` leaves it now: validated, notes trimmed, no weight field when empty. */
export function newWeeklyReviewData(
  weekNumber: number,
  draft: WeeklyReviewDraft,
  uid: string
): NewWeeklyReviewData {
  const errors = validateWeeklyReviewDraft(draft);
  if (errors.length > 0) throw new ValidationFailedError(errors);
  return {
    notes: draft.notes.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    weekNumber,
    ...(draft.weightKg === null ? {} : { weightKg: draft.weightKg }),
  };
}

/** The weight of a review, also kept as a weight log (AC5.3). */
export const newWeightLogData = (
  kg: number,
  measuredOn: IsoDate,
  uid: string
): NewWeightLogData => ({
  doneAt: serverTimestamp(),
  doneBy: uid,
  kg,
  measuredOn,
});

/** Reads a stored review; the document id is its week number. */
export const parseWeeklyReview = (id: string, path: string, data: DocumentData): WeeklyReview => {
  const reader = new DocumentReader(path, data);
  const notes = reader.optionalString('notes');
  if (notes.length > REVIEW_NOTES_MAX) throw new InvalidDocumentError(path, 'notes');
  return {
    notes,
    updatedAt: reader.timestamp('updatedAt'),
    updatedBy: reader.string('updatedBy'),
    weekNumber: reader.integer('weekNumber', PREPARATION_WEEK, 52),
    weightKg: reader.nullableNumber('weightKg', WEIGHT_MIN_KG, WEIGHT_MAX_KG),
  };
};

export const weeklyReviewConverter = readOnlyConverter(parseWeeklyReview);
