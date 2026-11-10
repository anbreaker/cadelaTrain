import {
  CAPTION_MAX,
  isHouseholdPublicId,
  Media,
  mediaByDay,
  MediaDraft,
  PHOTO_MAX_BYTES,
  validateMediaDraft,
  validatePhotoFile,
  youtubeIdFrom,
} from './media';

const ID = 'dQw4w9WgXcQ';

describe('youtubeIdFrom (AC7.3)', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `http://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&t=42s`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `http://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://youtube.com/shorts/${ID}?feature=share`,
    `  https://youtu.be/${ID}  `,
  ])('should extract only the 11-character id from %s', (link) => {
    expect(youtubeIdFrom(link)).toBe(ID);
  });

  it('should keep - and _ in the id', () => {
    expect(youtubeIdFrom('https://youtu.be/a-b_c-d_e-f')).toBe('a-b_c-d_e-f');
  });

  it.each([
    '',
    'hello',
    ID,
    `youtube.com/watch?v=${ID}`,
    `ftp://youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}x`,
    `https://www.youtube.com/watch?v=dQw4w9WgXc`,
    `https://www.youtube.com/watch?list=${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://youtu.be/${ID}/extra`,
    `https://www.youtube.com/shorts/${ID}/extra`,
    `https://vimeo.com/${ID}`,
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://youtu.be/dQw4w9WgX%3CQ`,
  ])('should return null for %j', (text) => {
    expect(youtubeIdFrom(text)).toBeNull();
  });
});

describe('validateMediaDraft (AC7.3, AC7.4)', () => {
  const draft = (overrides: Partial<MediaDraft> = {}): MediaDraft => ({
    caption: '',
    date: '2026-12-05',
    kind: 'video',
    skillKey: null,
    videoLink: `https://youtu.be/${ID}`,
    ...overrides,
  });

  it('should accept a video with a YouTube link, a date and no caption', () => {
    expect(validateMediaDraft(draft())).toEqual([]);
  });

  it('should accept a photo draft without link', () => {
    expect(validateMediaDraft(draft({ kind: 'photo', videoLink: '' }))).toEqual([]);
  });

  it('should accept a caption of exactly 280 characters, ignoring surrounding spaces', () => {
    expect(validateMediaDraft(draft({ caption: ` ${'a'.repeat(CAPTION_MAX)} ` }))).toEqual([]);
  });

  it('should refuse a caption longer than 280 characters', () => {
    expect(validateMediaDraft(draft({ caption: 'a'.repeat(281) }))).toEqual(['captionTooLong']);
  });

  it('should refuse any other text as a video link', () => {
    expect(validateMediaDraft(draft({ videoLink: 'https://vimeo.com/123' }))).toEqual([
      'videoLinkInvalid',
    ]);
  });

  it.each(['', '2026-02-30', '05/12/2026'])('should refuse the date %j', (date) => {
    expect(validateMediaDraft(draft({ date }))).toEqual(['dateInvalid']);
  });

  it('should report every problem at once, in rule order', () => {
    expect(
      validateMediaDraft(draft({ caption: 'a'.repeat(281), date: '', videoLink: 'x' }))
    ).toEqual(['captionTooLong', 'videoLinkInvalid', 'dateInvalid']);
  });
});

describe('media limits', () => {
  it('should cap photos at 10 MB and captions at 280 characters (AC7.2, AC7.4)', () => {
    expect(PHOTO_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(CAPTION_MAX).toBe(280);
  });
});

describe('validatePhotoFile (AC7.2)', () => {
  it('should accept an image up to the size limit', () => {
    expect(validatePhotoFile({ size: PHOTO_MAX_BYTES, type: 'image/jpeg' })).toEqual([]);
  });

  it('should ask for a photo when none is chosen', () => {
    expect(validatePhotoFile(null)).toEqual(['photoMissing']);
  });

  it('should refuse a file that is not an image', () => {
    expect(validatePhotoFile({ size: 10, type: 'video/mp4' })).toEqual(['photoNotImage']);
  });

  it('should refuse an image above the size limit', () => {
    expect(validatePhotoFile({ size: PHOTO_MAX_BYTES + 1, type: 'image/png' })).toEqual([
      'photoTooLarge',
    ]);
  });
});

describe('isHouseholdPublicId (AC7.7)', () => {
  it('should accept exactly dela/<householdId>/<id>', () => {
    expect(isHouseholdPublicId('dela/h1/abc_DEF-123', 'h1')).toBe(true);
  });

  it.each([
    'abc123',
    'dela/h2/abc123',
    'dela/h1/sub/abc123',
    'dela/h1/',
    'dela/h1/abc.jpg',
    `dela/h1/${'a'.repeat(101)}`,
    'other/dela/h1/abc123',
  ])('should refuse %s', (publicId) => {
    expect(isHouseholdPublicId(publicId, 'h1')).toBe(false);
  });
});

describe('mediaByDay (AC7.5)', () => {
  const item = (id: string, date: string, addedAt: string): Media => ({
    addedAt: new Date(addedAt),
    addedBy: 'alice',
    caption: '',
    date,
    id,
    kind: 'video',
    youtubeId: ID,
  });

  it('should group by date, newest day first and newest added first within a day', () => {
    const days = mediaByDay([
      item('a', '2026-12-10', '2026-12-10T08:00:00Z'),
      item('b', '2026-12-12', '2026-12-12T08:00:00Z'),
      item('c', '2026-12-10', '2026-12-10T09:00:00Z'),
    ]);

    expect(days.map(({ date, items }) => [date, items.map(({ id }) => id)])).toEqual([
      ['2026-12-12', ['b']],
      ['2026-12-10', ['c', 'a']],
    ]);
  });

  it('should return no days for no media', () => {
    expect(mediaByDay([])).toEqual([]);
  });
});
