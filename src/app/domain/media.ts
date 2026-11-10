import { isIsoDate, IsoDate } from './dates';
import { collectErrors, ValidationRule } from './validation';

export const CAPTION_MAX = 280;
/** Photos above this size are refused before upload; the Cloudinary preset caps it too (AC7.2). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Largest photo side the rules accept, in pixels. */
export const PHOTO_SIDE_MAX = 20000;

export type MediaKind = 'photo' | 'video';
export const MEDIA_KINDS: readonly MediaKind[] = ['photo', 'video'];

/** A photo or video of a day (AC7.1, AC7.4). Only the fields of its `kind` are present. */
export interface Media {
  addedAt: Date;
  /** uid of the member who added it. */
  addedBy: string;
  /** Empty when there is none. */
  caption: string;
  /** Madrid date the item belongs to. */
  date: IsoDate;
  /** `photo` only. */
  height?: number;
  id: string;
  kind: MediaKind;
  /** `photo` only: Cloudinary public id under `dela/<householdId>/`. */
  publicId?: string;
  skillKey?: string;
  /** `photo` only. */
  width?: number;
  /** `video` only: the 11-character YouTube id. */
  youtubeId?: string;
}

/** What a member fills in the add-media form; `videoLink` is the pasted text of a video. */
export interface MediaDraft {
  caption: string;
  date: IsoDate;
  kind: MediaKind;
  skillKey: null | string;
  videoLink: string;
}

export type MediaError = 'captionTooLong' | 'dateInvalid' | 'videoLinkInvalid';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SHORTS_PATH = /^\/shorts\/([^/]+)\/?$/;
const SHORT_LINK_PATH = /^\/([^/]+)$/;

/** A stored YouTube id: exactly 11 characters of `A-Z a-z 0-9 _ -`. */
export const isYoutubeId = (value: string): boolean => YOUTUBE_ID.test(value);

type IdReader = (url: URL) => null | string | undefined;

const fromWatchOrShorts: IdReader = (url) =>
  url.pathname === '/watch' ? url.searchParams.get('v') : SHORTS_PATH.exec(url.pathname)?.[1];

const ID_READERS: Readonly<Record<string, IdReader>> = {
  'm.youtube.com': fromWatchOrShorts,
  'www.youtube.com': fromWatchOrShorts,
  'youtu.be': (url) => SHORT_LINK_PATH.exec(url.pathname)?.[1],
  'youtube.com': fromWatchOrShorts,
};

const parseUrl = (text: string): null | URL => {
  try {
    return new URL(text.trim());
  } catch {
    return null;
  }
};

/**
 * The 11-character id of a `youtube.com/watch?v=`, `youtu.be/` or `youtube.com/shorts/` link
 * (http or https), or `null` for any other text (AC7.3). Only the id is ever stored.
 */
export function youtubeIdFrom(text: string): null | string {
  const url = parseUrl(text);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return null;
  const read = Object.hasOwn(ID_READERS, url.hostname) ? ID_READERS[url.hostname] : undefined;
  const id = read?.(url);
  return id && isYoutubeId(id) ? id : null;
}

const MEDIA_RULES: readonly ValidationRule<MediaDraft, MediaError>[] = [
  { code: 'captionTooLong', fails: ({ caption }) => caption.trim().length > CAPTION_MAX },
  {
    code: 'videoLinkInvalid',
    fails: ({ kind, videoLink }) => kind === 'video' && youtubeIdFrom(videoLink) === null,
  },
  { code: 'dateInvalid', fails: ({ date }) => !isIsoDate(date) },
];

export const validateMediaDraft = (draft: MediaDraft): MediaError[] =>
  collectErrors(draft, MEDIA_RULES);

/** What the photo checks need from a chosen `File`. */
export interface PhotoFile {
  size: number;
  type: string;
}

export type PhotoFileError = 'photoMissing' | 'photoNotImage' | 'photoTooLarge';

const PHOTO_FILE_RULES: readonly ValidationRule<PhotoFile, PhotoFileError>[] = [
  { code: 'photoNotImage', fails: ({ type }) => !type.startsWith('image/') },
  { code: 'photoTooLarge', fails: ({ size }) => size > PHOTO_MAX_BYTES },
];

/** A photo must be an image of at most `PHOTO_MAX_BYTES` (AC7.2); `null` means none was chosen. */
export const validatePhotoFile = (file: null | PhotoFile): PhotoFileError[] =>
  file ? collectErrors(file, PHOTO_FILE_RULES) : ['photoMissing'];

const PUBLIC_ID_NAME = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Whether a Cloudinary public id is exactly `dela/<householdId>/<id>`, the only shape the rules
 * accept: an account with dynamic folders returns a bare id unless its preset prefixes the folder.
 */
export function isHouseholdPublicId(publicId: string, householdId: string): boolean {
  const prefix = `dela/${householdId}/`;
  return publicId.startsWith(prefix) && PUBLIC_ID_NAME.test(publicId.slice(prefix.length));
}

/** The media of one Madrid date. */
export interface MediaDay {
  date: IsoDate;
  items: Media[];
}

/** Newest date first; within a day, newest added first. */
const byDateThenAddedDesc = (a: Media, b: Media): number =>
  b.date.localeCompare(a.date) || b.addedAt.getTime() - a.addedAt.getTime();

/** Groups media per date, newest day first and newest added first within a day (AC7.5). */
export function mediaByDay(media: readonly Media[]): MediaDay[] {
  return [...media].sort(byDateThenAddedDesc).reduce<MediaDay[]>((days, item) => {
    const last = days.at(-1);
    if (last?.date === item.date) last.items.push(item);
    else days.push({ date: item.date, items: [item] });
    return days;
  }, []);
}
