import { InvalidDocumentError, ValidationFailedError } from './data-errors';
import { newPhotoMediaData, newVideoMediaData, parseMedia } from './media.converter';

import { serverTimestamp, Timestamp } from 'firebase/firestore';

const PATH = 'households/h1/dogs/d1/media/m1';
const ADDED_AT = new Date('2026-12-05T10:00:00Z');
const YOUTUBE_ID = 'dQw4w9WgXcQ';
const PUBLIC_ID = 'dela/h1/alice/k3j9x0aa1b2c3d4e5f6g';

const storedVideo = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  addedAt: Timestamp.fromDate(ADDED_AT),
  addedBy: 'alice',
  caption: 'Sit at the door',
  date: '2026-12-05',
  kind: 'video',
  skillKey: 'sit',
  youtubeId: YOUTUBE_ID,
  ...overrides,
});

const storedPhoto = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  addedAt: Timestamp.fromDate(ADDED_AT),
  addedBy: 'bob',
  date: '2026-12-06',
  height: 1080,
  kind: 'photo',
  publicId: PUBLIC_ID,
  width: 1920,
  ...overrides,
});

describe('parseMedia (AC7.4)', () => {
  it('should read a video with its id, caption, skill, author and time', () => {
    expect(parseMedia('m1', PATH, storedVideo())).toEqual({
      addedAt: ADDED_AT,
      addedBy: 'alice',
      caption: 'Sit at the door',
      date: '2026-12-05',
      id: 'm1',
      kind: 'video',
      skillKey: 'sit',
      youtubeId: YOUTUBE_ID,
    });
  });

  it('should read a photo with its public id and size, an empty caption and no skill', () => {
    expect(parseMedia('m2', PATH, storedPhoto())).toEqual({
      addedAt: ADDED_AT,
      addedBy: 'bob',
      caption: '',
      date: '2026-12-06',
      height: 1080,
      id: 'm2',
      kind: 'photo',
      publicId: PUBLIC_ID,
      width: 1920,
    });
  });

  it('should ignore the fields of the other kind', () => {
    const media = parseMedia('m1', PATH, storedVideo({ publicId: PUBLIC_ID, width: 10 }));

    expect(media).not.toHaveProperty('publicId');
    expect(media).not.toHaveProperty('width');
  });

  it.each([
    ['an unknown kind', storedVideo({ kind: 'audio' })],
    ['a bad youtube id', storedVideo({ youtubeId: 'nope' })],
    ['a video without youtube id', storedVideo({ youtubeId: undefined })],
    ['a photo without public id', storedPhoto({ publicId: undefined })],
    ['a photo without width', storedPhoto({ width: undefined })],
    ['a photo with a fractional height', storedPhoto({ height: 10.5 })],
    ['an invalid date', storedVideo({ date: '2026-02-30' })],
    ['a caption over 280 characters', storedVideo({ caption: 'a'.repeat(281) })],
    ['an empty skill key', storedVideo({ skillKey: '' })],
    ['a missing addedAt', storedVideo({ addedAt: undefined })],
  ])('should reject %s', (_name, data) => {
    expect(() => parseMedia('m1', PATH, data)).toThrow(InvalidDocumentError);
  });
});

describe('newVideoMediaData (AC7.3, AC7.4)', () => {
  const draft = {
    caption: '  Sit at the door ',
    date: '2026-12-05',
    kind: 'video' as const,
    skillKey: 'sit',
    videoLink: `https://youtu.be/${YOUTUBE_ID}?si=x`,
  };

  it('should store only the YouTube id, the trimmed caption, the author and the server time', () => {
    expect(newVideoMediaData(draft, 'alice')).toEqual({
      addedAt: serverTimestamp(),
      addedBy: 'alice',
      caption: 'Sit at the door',
      date: '2026-12-05',
      kind: 'video',
      skillKey: 'sit',
      youtubeId: YOUTUBE_ID,
    });
  });

  it('should omit an empty caption and a missing skill', () => {
    const data = newVideoMediaData({ ...draft, caption: '   ', skillKey: null }, 'alice');

    expect(data).not.toHaveProperty('caption');
    expect(data).not.toHaveProperty('skillKey');
  });

  it('should refuse any text that is not a YouTube link, with its code', () => {
    expect(() => newVideoMediaData({ ...draft, videoLink: 'hello' }, 'alice')).toThrow(
      new ValidationFailedError(['videoLinkInvalid'])
    );
  });

  it('should refuse a long caption and an invalid date', () => {
    expect(() =>
      newVideoMediaData({ ...draft, caption: 'a'.repeat(281), date: 'x' }, 'alice')
    ).toThrow(new ValidationFailedError(['captionTooLong', 'dateInvalid']));
  });
});

describe('newPhotoMediaData (AC7.2, AC7.4)', () => {
  const record = {
    caption: ' First walk ',
    date: '2026-12-06',
    height: 1080,
    publicId: PUBLIC_ID,
    skillKey: 'leash',
    width: 1920,
  };

  it('should store the Cloudinary public id and size, the author and the server time', () => {
    expect(newPhotoMediaData(record, 'bob')).toEqual({
      addedAt: serverTimestamp(),
      addedBy: 'bob',
      caption: 'First walk',
      date: '2026-12-06',
      height: 1080,
      kind: 'photo',
      publicId: PUBLIC_ID,
      skillKey: 'leash',
      width: 1920,
    });
  });

  it('should omit an empty caption and a missing skill', () => {
    const data = newPhotoMediaData({ ...record, caption: '', skillKey: null }, 'bob');

    expect(data).not.toHaveProperty('caption');
    expect(data).not.toHaveProperty('skillKey');
  });

  it('should refuse a long caption', () => {
    expect(() => newPhotoMediaData({ ...record, caption: 'a'.repeat(281) }, 'bob')).toThrow(
      new ValidationFailedError(['captionTooLong'])
    );
  });
});
