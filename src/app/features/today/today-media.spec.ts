import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { MediaRepository } from '@data/media.repository';
import {
  CLOUDINARY_CLOUD_NAME,
  PhotoUploadError,
  PhotoUploadService,
} from '@data/photo-upload.service';
import { Dog } from '@domain/dog';
import { Household } from '@domain/household';
import { Media } from '@domain/media';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { TodayMediaComponent } from './today-media';

import { vi } from 'vitest';

const ID = 'dQw4w9WgXcQ';

const dela: Dog = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  id: 'd1',
  name: 'Dela',
  notes: '',
  planWeek: 1,
  sleepsOutdoors: true,
};

const home: Household = {
  id: 'h1',
  locale: 'es',
  memberIds: ['alice', 'bob'],
  members: {
    alice: { displayName: 'Jéssica', role: 'owner' },
    bob: { displayName: 'Javier', role: 'member' },
  },
  name: 'Casa',
  ownerId: 'alice',
  timezone: 'Europe/Madrid',
};

const myPhoto: Media = {
  addedAt: new Date('2026-12-20T09:00:00Z'),
  addedBy: 'alice',
  caption: 'Sit!',
  date: '2026-12-20',
  height: 600,
  id: 'm1',
  kind: 'photo',
  publicId: 'dela/h1/alice/abc123',
  width: 800,
};

const theirVideo: Media = {
  addedAt: new Date('2026-12-20T08:00:00Z'),
  addedBy: 'bob',
  caption: '',
  date: '2026-12-20',
  id: 'm2',
  kind: 'video',
  youtubeId: ID,
};

const imageFile = (): File => new File(['x'], 'dela.jpg', { type: 'image/jpeg' });

describe('TodayMediaComponent', () => {
  let session: FakeSession;
  let media$: Observable<Media[]>;
  let repository: {
    addPhoto: ReturnType<typeof vi.fn>;
    addVideo: ReturnType<typeof vi.fn>;
    watchRange: ReturnType<typeof vi.fn>;
  };
  let uploads: { removeMedia: ReturnType<typeof vi.fn>; uploadPhoto: ReturnType<typeof vi.fn> };
  let cloudName: string;
  let fixture: ComponentFixture<TodayMediaComponent>;

  const render = async (): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      imports: [TodayMediaComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        { provide: NOW, useValue: () => new Date('2026-12-20T10:00:00Z') },
        { provide: MediaRepository, useValue: repository },
        { provide: PhotoUploadService, useValue: uploads },
        { provide: CLOUDINARY_CLOUD_NAME, useValue: cloudName },
      ],
    });
    fixture = TestBed.createComponent(TodayMediaComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const click = async (selector: string): Promise<void> => {
    element().querySelector<HTMLElement>(selector)?.click();
    await fixture.whenStable();
  };
  const type = async (selector: string, value: string): Promise<void> => {
    const field = element().querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const choosePhoto = async (file: File): Promise<void> => {
    const input = element().querySelector('.media-form__photo') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  const chooseVideo = async (): Promise<void> => {
    const video = [...element().querySelectorAll<HTMLButtonElement>('.segmented__option')].find(
      (button) => button.textContent?.trim() === 'media.kinds.video'
    );
    video?.click();
    await fixture.whenStable();
  };
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.dog.set(dela);
    session.set.household.set(home);
    session.set.profile.set({
      displayName: 'Jéssica',
      email: 'j@example.com',
      locale: 'es',
      uid: 'alice',
    });
    cloudName = 'demo-cloud';
    media$ = of([theirVideo, myPhoto]);
    repository = {
      addPhoto: vi.fn(async () => 'm3'),
      addVideo: vi.fn(async () => 'm4'),
      watchRange: vi.fn(() => media$),
    };
    uploads = {
      removeMedia: vi.fn(async () => undefined),
      uploadPhoto: vi.fn(async () => ({
        height: 900,
        publicId: 'dela/h1/alice/new1',
        width: 1200,
      })),
    };
  });

  it('should show the media of the Madrid day, newest first, delete only on mine (AC7.5, AC7.6)', async () => {
    const root = await render();

    expect(repository.watchRange).toHaveBeenCalledWith('h1', 'd1', '2026-12-20', '2026-12-20');
    expect(root.querySelector('.today-media__title')?.textContent).toContain('media.todayTitle');
    const items = [...root.querySelectorAll('app-media-item')];
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector('img.media-item__photo')).not.toBeNull();
    expect(items[0]?.querySelector('.media-item__delete')).not.toBeNull();
    expect(items[1]?.querySelector('.media-item__play')).not.toBeNull();
    expect(items[1]?.querySelector('.media-item__delete')).toBeNull();
    expect(root.querySelector('.media-list__date')).toBeNull();
  });

  it('should say when the day has no media (AC7.1)', async () => {
    media$ = of([]);
    const root = await render();

    expect(root.querySelector('.today-media__empty')?.textContent).toContain('media.empty');
  });

  it('should open the form only after "Add"', async () => {
    const root = await render();
    expect(root.querySelector('app-media-form')).toBeNull();

    await click('.today-media__add');

    expect(root.querySelector('app-media-form')).not.toBeNull();
    await click('.media-form__cancel');
    expect(root.querySelector('app-media-form')).toBeNull();
  });

  it('should upload a photo and then record it with the form fields (AC7.2, AC7.4)', async () => {
    await render();
    await click('.today-media__add');
    const file = imageFile();
    await choosePhoto(file);
    await type('.media-form__caption', 'Sit');
    await click('.media-form__save');
    await settle();

    expect(uploads.uploadPhoto).toHaveBeenCalledWith('h1', 'alice', file);
    expect(repository.addPhoto).toHaveBeenCalledWith(
      'h1',
      'd1',
      {
        caption: 'Sit',
        date: '2026-12-20',
        height: 900,
        publicId: 'dela/h1/alice/new1',
        skillKey: null,
        width: 1200,
      },
      'alice'
    );
    expect(repository.addVideo).not.toHaveBeenCalled();
    expect(element().querySelector('app-media-form')).toBeNull();
    expect(element().querySelector('.today-media__saved')?.textContent).toContain('media.saved');
  });

  it('should store a video link through the repository, with no upload (AC7.3)', async () => {
    await render();
    await click('.today-media__add');
    await chooseVideo();
    await type('.media-form__video', `https://youtu.be/${ID}`);
    await click('.media-form__save');
    await settle();

    expect(repository.addVideo).toHaveBeenCalledWith(
      'h1',
      'd1',
      {
        caption: '',
        date: '2026-12-20',
        kind: 'video',
        skillKey: null,
        videoLink: `https://youtu.be/${ID}`,
      },
      'alice'
    );
    expect(uploads.uploadPhoto).not.toHaveBeenCalled();
  });

  it('should say an item saved for another day is in that week review, not on Today', async () => {
    await render();
    await click('.today-media__add');
    await chooseVideo();
    await type('.media-form__video', `https://youtu.be/${ID}`);
    const date = element().querySelector('.media-form__date') as HTMLInputElement;
    date.value = '2026-12-18';
    date.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    await click('.media-form__save');
    await settle();

    expect(repository.addVideo).toHaveBeenCalledWith(
      'h1',
      'd1',
      expect.objectContaining({ date: '2026-12-18' }),
      'alice'
    );
    expect(element().querySelector('.today-media__saved')?.textContent?.trim()).toBe(
      'media.savedFor'
    );
  });

  it('should store nothing on a validation error (AC7.3)', async () => {
    await render();
    await click('.today-media__add');
    await chooseVideo();
    await type('.media-form__video', 'not a link');
    await click('.media-form__save');
    await settle();

    expect(element().querySelector('.field__error')?.textContent).toContain(
      'media.errors.videoLinkInvalid'
    );
    expect(repository.addVideo).not.toHaveBeenCalled();
    expect(uploads.uploadPhoto).not.toHaveBeenCalled();
  });

  it('should keep the form open with the upload error and record nothing', async () => {
    uploads.uploadPhoto.mockRejectedValueOnce(new PhotoUploadError('unexpectedPublicId'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await render();
    await click('.today-media__add');
    await choosePhoto(imageFile());
    await click('.media-form__save');
    await settle();

    expect(repository.addPhoto).not.toHaveBeenCalled();
    expect(element().querySelector('app-media-form')).not.toBeNull();
    expect(element().querySelector('.today-media__error')?.textContent).toContain(
      'media.errors.unexpectedPublicId'
    );
  });

  it('should show a generic error when recording fails', async () => {
    repository.addPhoto.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await render();
    await click('.today-media__add');
    await choosePhoto(imageFile());
    await click('.media-form__save');
    await settle();

    expect(element().querySelector('.today-media__error')?.textContent).toContain(
      'media.errors.saveFailed'
    );
  });

  it('should offer only videos when no cloud name is configured', async () => {
    cloudName = '';
    const root = await render();
    await click('.today-media__add');

    expect(root.querySelector('.media-form__photo')).toBeNull();
    expect(root.querySelector('.media-form__photo-off')).not.toBeNull();
  });

  it('should delete my item through the upload service (AC7.6)', async () => {
    await render();
    await click('.media-item__delete');
    await settle();

    expect(uploads.removeMedia).toHaveBeenCalledWith('h1', 'd1', myPhoto);
  });

  it('should say when a deletion fails', async () => {
    uploads.removeMedia.mockRejectedValueOnce(new PhotoUploadError('deleteFailed'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await render();
    await click('.media-item__delete');
    await settle();

    expect(element().querySelector('.today-media__error')?.textContent).toContain(
      'media.errors.deleteFailed'
    );
  });

  it('should show a read error instead of the list', async () => {
    media$ = throwError(() => new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root = await render();

    expect(root.querySelector('.today-media__error')?.textContent).toContain(
      'media.errors.readFailed'
    );
  });
});
