import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { cloudinaryUrl, PHOTO_SIZES } from '@domain/cloudinary-url';
import { Media } from '@domain/media';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { MediaItemView } from '../media-list/media-list-view';
import { MediaItemComponent } from './media-item';

const photo: Media = {
  addedAt: new Date('2026-12-20T08:00:00Z'),
  addedBy: 'alice',
  caption: 'First walk',
  date: '2026-12-20',
  height: 900,
  id: 'm1',
  kind: 'photo',
  publicId: 'dela/h1/abc123',
  skillKey: 'name',
  width: 1200,
};

const video: Media = {
  addedAt: new Date('2026-12-20T09:00:00Z'),
  addedBy: 'bob',
  caption: '',
  date: '2026-12-20',
  id: 'm2',
  kind: 'video',
  youtubeId: 'dQw4w9WgXcQ',
};

@Component({
  imports: [MediaItemComponent],
  template: `
    <app-media-item
      [busy]="busy()"
      [cloudName]="cloudName()"
      [item]="item()"
      (removed)="removed.push($event)"
    />
  `,
})
class HostComponent {
  readonly busy = signal(false);
  readonly cloudName = signal('demo-cloud');
  readonly item = signal<MediaItemView>({ author: 'Jéssica', canDelete: false, media: photo });
  readonly removed: Media[] = [];
}

describe('MediaItemComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const render = async (
    setup: (host: HostComponent) => void = () => undefined
  ): Promise<HTMLElement> => {
    TestBed.configureTestingModule({ imports: [HostComponent, translocoTesting()] });
    fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('should show a photo in responsive Cloudinary sizes, lazily, with its caption as alt (AC7.5)', async () => {
    const element = await render();
    const img = element.querySelector('img.media-item__photo') as HTMLImageElement;
    const url = (width: number): string => cloudinaryUrl('demo-cloud', 'dela/h1/abc123', width);

    expect(img.getAttribute('src')).toBe(url(640));
    expect(img.getAttribute('srcset')).toBe(
      [320, 640, 960].map((width) => `${url(width)} ${width}w`).join(', ')
    );
    expect(img.getAttribute('sizes')).toBe(PHOTO_SIZES);
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.getAttribute('height')).toBe('900');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe('First walk');
    expect(element.querySelector('.media-item__caption')?.textContent).toContain('First walk');
    expect(element.querySelector('.media-item__skill')?.textContent).toContain(
      'catalog.skills.name.name'
    );
    expect(element.querySelector('.media-item__author')?.textContent).toContain('media.addedBy');
  });

  it('should use a generic alt for a photo without caption', async () => {
    const element = await render((host) =>
      host.item.set({ author: 'Jéssica', canDelete: false, media: { ...photo, caption: '' } })
    );

    expect(element.querySelector('img')?.getAttribute('alt')).toBe('media.photoAlt');
    expect(element.querySelector('.media-item__caption')).toBeNull();
  });

  it('should show a notice instead of a photo without a cloud name', async () => {
    const element = await render((host) => host.cloudName.set(''));

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.media-item__unavailable')?.textContent).toContain(
      'media.photoUnavailable'
    );
  });

  it('should show a video as a thumbnail and load the player only after a tap (AC7.5)', async () => {
    const element = await render((host) =>
      host.item.set({ author: 'Javier', canDelete: false, media: video })
    );
    const play = element.querySelector('button.media-item__play') as HTMLButtonElement;

    expect(element.querySelector('iframe')).toBeNull();
    expect(play.querySelector('img')?.getAttribute('src')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );
    expect(play.getAttribute('aria-label')).toBe('media.play');
    expect(element.querySelector('.media-item__skill')).toBeNull();

    play.click();
    await fixture.whenStable();

    const iframe = element.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'
    );
    expect(iframe.getAttribute('title')).toBe('media.videoTitle');
    expect(element.querySelector('button.media-item__play')).toBeNull();
  });

  it('should offer delete only to the author and emit the item (AC7.6)', async () => {
    const element = await render();
    expect(element.querySelector('.media-item__delete')).toBeNull();

    fixture.componentInstance.item.set({ author: 'Jéssica', canDelete: true, media: photo });
    await fixture.whenStable();
    (element.querySelector('.media-item__delete') as HTMLButtonElement).click();

    expect(fixture.componentInstance.removed).toEqual([photo]);
  });

  it('should disable delete while busy', async () => {
    const element = await render((host) => {
      host.item.set({ author: 'Jéssica', canDelete: true, media: photo });
      host.busy.set(true);
    });

    expect((element.querySelector('.media-item__delete') as HTMLButtonElement).disabled).toBe(true);
  });
});
