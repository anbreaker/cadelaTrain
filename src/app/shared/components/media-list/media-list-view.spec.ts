import { Media } from '@domain/media';

import { mediaDayViews } from './media-list-view';

const item = (id: string, date: string, addedBy: string): Media => ({
  addedAt: new Date(`${date}T08:00:00Z`),
  addedBy,
  caption: '',
  date,
  id,
  kind: 'video',
  youtubeId: 'dQw4w9WgXcQ',
});

describe('mediaDayViews (AC7.5, AC7.6)', () => {
  const context = {
    formatDate: (date: string): string => `label-${date}`,
    members: {
      alice: { displayName: 'Jéssica', role: 'owner' as const },
      bob: { displayName: 'Javier', role: 'member' as const },
    },
    uid: 'alice',
  };

  it('should group per day, name the author and let only the author delete', () => {
    const days = mediaDayViews(
      [item('a', '2026-12-10', 'alice'), item('b', '2026-12-11', 'bob')],
      context
    );

    expect(days).toEqual([
      {
        date: '2026-12-11',
        items: [
          { author: 'Javier', canDelete: false, media: expect.objectContaining({ id: 'b' }) },
        ],
        label: 'label-2026-12-11',
      },
      {
        date: '2026-12-10',
        items: [
          { author: 'Jéssica', canDelete: true, media: expect.objectContaining({ id: 'a' }) },
        ],
        label: 'label-2026-12-10',
      },
    ]);
  });

  it('should show a dash for a former member and nothing deletable while signed out', () => {
    const [day] = mediaDayViews([item('a', '2026-12-10', 'carol')], { ...context, uid: null });

    expect(day?.items[0]).toMatchObject({ author: '—', canDelete: false });
  });
});
