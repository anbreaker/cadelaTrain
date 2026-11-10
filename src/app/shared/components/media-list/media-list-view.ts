import { IsoDate } from '@domain/dates';
import { Household } from '@domain/household';
import { Media, mediaByDay } from '@domain/media';

/** One photo or video as a list shows it: who added it and whether the viewer may delete it. */
export interface MediaItemView {
  author: string;
  /** Only the author deletes an item (AC7.6). */
  canDelete: boolean;
  media: Media;
}

/** The media of one Madrid date, with its date already formatted. */
export interface MediaDayView {
  date: IsoDate;
  items: MediaItemView[];
  label: string;
}

export interface MediaViewContext {
  formatDate: (date: IsoDate) => string;
  members: Household['members'];
  /** The viewer; `null` while signed out. */
  uid: null | string;
}

/** Media per day, newest day first, ready for `app-media-list` (AC7.5). */
export const mediaDayViews = (
  media: readonly Media[],
  { formatDate, members, uid }: MediaViewContext
): MediaDayView[] =>
  mediaByDay(media).map(({ date, items }) => ({
    date,
    items: items.map((item) => ({
      author: members[item.addedBy]?.displayName ?? '—',
      canDelete: uid !== null && item.addedBy === uid,
      media: item,
    })),
    label: formatDate(date),
  }));
