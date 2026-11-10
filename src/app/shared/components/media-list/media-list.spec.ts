import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Media } from '@domain/media';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { MediaListComponent } from './media-list';
import { MediaDayView } from './media-list-view';

const video = (id: string, date: string): Media => ({
  addedAt: new Date(`${date}T08:00:00Z`),
  addedBy: 'alice',
  caption: '',
  date,
  id,
  kind: 'video',
  youtubeId: 'dQw4w9WgXcQ',
});

const DAYS: MediaDayView[] = [
  {
    date: '2026-12-11',
    items: [{ author: 'Jéssica', canDelete: true, media: video('b', '2026-12-11') }],
    label: '11 dic',
  },
  {
    date: '2026-12-10',
    items: [
      { author: 'Jéssica', canDelete: true, media: video('a', '2026-12-10') },
      { author: 'Javier', canDelete: false, media: video('c', '2026-12-10') },
    ],
    label: '10 dic',
  },
];

@Component({
  imports: [MediaListComponent],
  template: `
    <app-media-list
      cloudName="demo-cloud"
      [busyId]="busyId()"
      [days]="days()"
      [showDates]="showDates()"
      (removed)="removed.push($event)"
    />
  `,
})
class HostComponent {
  readonly busyId = signal<null | string>(null);
  readonly days = signal(DAYS);
  readonly showDates = signal(true);
  readonly removed: Media[] = [];
}

describe('MediaListComponent', () => {
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

  it('should show the items per day under their date, in the given order (AC7.5)', async () => {
    const element = await render();

    expect(
      [...element.querySelectorAll('.media-list__date')].map((node) => node.textContent?.trim())
    ).toEqual(['11 dic', '10 dic']);
    expect(
      element.querySelectorAll('.media-list__day')[1]?.querySelectorAll('app-media-item')
    ).toHaveLength(2);
  });

  it('should hide the dates when asked', async () => {
    const element = await render((host) => host.showDates.set(false));

    expect(element.querySelector('.media-list__date')).toBeNull();
    expect(element.querySelectorAll('app-media-item')).toHaveLength(3);
  });

  it('should emit the item to delete and disable only the one being deleted (AC7.6)', async () => {
    const element = await render((host) => host.busyId.set('a'));
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.media-item__delete')];

    expect(buttons.map((button) => button.disabled)).toEqual([false, true]);
    buttons[0]?.click();
    expect(fixture.componentInstance.removed.map(({ id }) => id)).toEqual(['b']);
  });
});
