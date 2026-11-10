import { isIsoDate, IsoDate } from '@domain/dates';
import {
  CAPTION_MAX,
  isYoutubeId,
  Media,
  MEDIA_KINDS,
  MediaDraft,
  MediaKind,
  PHOTO_SIDE_MAX,
  validateMediaDraft,
  youtubeIdFrom,
} from '@domain/media';

import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import { DocumentReader } from './document-reader';
import { readOnlyConverter } from './firestore-converter';

import { DocumentData, FieldValue, serverTimestamp } from 'firebase/firestore';

/** The uploaded photo being recorded: what Cloudinary returned plus the form fields (AC7.2). */
export interface PhotoRecord {
  caption: string;
  date: IsoDate;
  height: number;
  publicId: string;
  skillKey: null | string;
  width: number;
}

interface NewMediaBaseData {
  addedAt: FieldValue;
  addedBy: string;
  caption?: string;
  date: IsoDate;
  skillKey?: string;
}

/** Exactly what `isVideo` in the rules accepts. */
export type NewVideoMediaData = NewMediaBaseData & { kind: 'video'; youtubeId: string };

/** Exactly what `isPhoto` in the rules accepts. */
export type NewPhotoMediaData = NewMediaBaseData & {
  height: number;
  kind: 'photo';
  publicId: string;
  width: number;
};

/** Validates the draft; the item is authored now by `uid`, empty caption and skill omitted. */
function newMediaBaseData(draft: MediaDraft, uid: string): NewMediaBaseData {
  const errors = validateMediaDraft(draft);
  if (errors.length > 0) throw new ValidationFailedError(errors);
  const caption = draft.caption.trim();
  return {
    addedAt: serverTimestamp(),
    addedBy: uid,
    ...(caption ? { caption } : {}),
    date: draft.date,
    ...(draft.skillKey ? { skillKey: draft.skillKey } : {}),
  };
}

/** A pasted YouTube link stored as its 11-character id only (AC7.3). */
export function newVideoMediaData(draft: MediaDraft, uid: string): NewVideoMediaData {
  const video = { ...draft, kind: 'video' as const };
  return {
    ...newMediaBaseData(video, uid),
    kind: 'video',
    youtubeId: youtubeIdFrom(video.videoLink) as string,
  };
}

/** The record of a photo already uploaded to Cloudinary (AC7.2). */
export function newPhotoMediaData(
  { caption, date, height, publicId, skillKey, width }: PhotoRecord,
  uid: string
): NewPhotoMediaData {
  return {
    ...newMediaBaseData({ caption, date, kind: 'photo', skillKey, videoLink: '' }, uid),
    height,
    kind: 'photo',
    publicId,
    width,
  };
}

type KindFields = Pick<Media, 'height' | 'publicId' | 'width' | 'youtubeId'>;

const KIND_FIELDS: Readonly<Record<MediaKind, (reader: DocumentReader) => KindFields>> = {
  photo: (reader) => ({
    height: reader.integer('height', 1, PHOTO_SIDE_MAX),
    publicId: reader.key('publicId'),
    width: reader.integer('width', 1, PHOTO_SIDE_MAX),
  }),
  video: (reader) => ({
    youtubeId: reader.stringWhere('youtubeId', isYoutubeId),
  }),
};

/** Reads a photo or video of a day; only the fields of its kind are kept. */
export const parseMedia = (id: string, path: string, data: DocumentData): Media => {
  const reader = new DocumentReader(path, data);
  const kind = reader.oneOf('kind', MEDIA_KINDS);
  const caption = reader.optionalString('caption');
  if (caption.length > CAPTION_MAX) throw new InvalidDocumentError(path, 'caption');
  const skillKey = reader.optionalKey('skillKey');
  return {
    addedAt: reader.timestamp('addedAt'),
    addedBy: reader.string('addedBy'),
    caption,
    date: reader.stringWhere('date', isIsoDate),
    id,
    kind,
    ...(skillKey === undefined ? {} : { skillKey }),
    ...KIND_FIELDS[kind](reader),
  };
};

export const mediaConverter = readOnlyConverter(parseMedia);
