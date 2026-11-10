import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SKILLS } from '@domain/catalog';
import { CAPTION_MAX, PHOTO_MAX_BYTES } from '@domain/media';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { MediaFormComponent, MediaSubmission } from './media-form';

const ID = 'dQw4w9WgXcQ';

@Component({
  imports: [MediaFormComponent],
  template: `
    <app-media-form
      today="2026-12-20"
      [busy]="busy()"
      [photoEnabled]="photoEnabled()"
      (cancelled)="cancelled = cancelled + 1"
      (saved)="saved.push($event)"
    />
  `,
})
class HostComponent {
  readonly busy = signal(false);
  readonly photoEnabled = signal(true);
  readonly saved: MediaSubmission[] = [];
  cancelled = 0;
}

const imageFile = (type = 'image/jpeg', size = 2048): File => {
  const file = new File(['x'], 'dela.jpg', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('MediaFormComponent', () => {
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

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const query = <T extends Element>(selector: string): T => element().querySelector(selector) as T;
  const settle = (): Promise<void> => fixture.whenStable();

  const type = async (selector: string, value: string, eventName = 'input'): Promise<void> => {
    const field = query<HTMLInputElement>(selector);
    field.value = value;
    field.dispatchEvent(new Event(eventName));
    await settle();
  };

  const chooseKind = async (labelKey: string): Promise<void> => {
    const button = [...element().querySelectorAll<HTMLButtonElement>('.segmented__option')].find(
      (option) => option.textContent?.trim() === labelKey
    );
    button?.click();
    await settle();
  };

  const choosePhoto = async (file: File | null): Promise<void> => {
    const input = query<HTMLInputElement>('.media-form__photo');
    Object.defineProperty(input, 'files', { configurable: true, value: file ? [file] : [] });
    input.dispatchEvent(new Event('change'));
    await settle();
  };

  const submit = async (): Promise<void> => {
    query<HTMLButtonElement>('.media-form__save').click();
    await settle();
  };

  const errors = (): string[] =>
    [...element().querySelectorAll('.field__error')].map((node) => node.textContent?.trim() ?? '');

  beforeEach(() => TestBed.resetTestingModule());

  it('should offer a camera-or-gallery image picker for a photo by default (AC7.2)', async () => {
    await render();
    const input = query<HTMLInputElement>('.media-form__photo');

    expect(input.type).toBe('file');
    expect(input.getAttribute('accept')).toBe('image/*');
    expect(input.getAttribute('capture')).toBe('environment');
    expect(query('.media-form__video')).toBeNull();
  });

  it('should default the date to today and offer every skill (AC7.4)', async () => {
    await render();

    expect(query<HTMLInputElement>('.media-form__date').value).toBe('2026-12-20');
    expect(query<HTMLInputElement>('.media-form__date').getAttribute('max')).toBe('2026-12-20');
    const options = [...query<HTMLSelectElement>('.media-form__skill').options];
    expect(options.map((option) => option.value)).toEqual(['', ...SKILLS.map(({ key }) => key)]);
    expect(options[1]?.textContent?.trim()).toBe(`catalog.skills.${SKILLS[0]?.key}.name`);
  });

  it('should emit a photo with its draft fields', async () => {
    await render();
    const file = imageFile();
    await choosePhoto(file);
    await type('.media-form__caption', '  First walk  ');
    await type('.media-form__date', '2026-12-19', 'change');
    await type('.media-form__skill', 'name', 'change');
    await submit();

    expect(fixture.componentInstance.saved).toEqual([
      {
        draft: {
          caption: '  First walk  ',
          date: '2026-12-19',
          kind: 'photo',
          skillKey: 'name',
          videoLink: '',
        },
        photo: file,
      },
    ]);
  });

  it.each([
    ['media.errors.photoMissing', null],
    ['media.errors.photoNotImage', imageFile('application/pdf')],
    ['media.errors.photoTooLarge', imageFile('image/png', PHOTO_MAX_BYTES + 1)],
  ])('should show %s and emit nothing (AC7.2)', async (key, file) => {
    await render();
    await choosePhoto(file);
    await submit();

    expect(errors()).toEqual([key]);
    expect(fixture.componentInstance.saved).toEqual([]);
  });

  it('should explain that a video must be unlisted and emit a valid link without a file (AC7.3)', async () => {
    await render();
    await chooseKind('media.kinds.video');

    expect(query('.media-form__photo')).toBeNull();
    expect(query('.media-form__video-hint')?.textContent).toContain('media.videoHint');

    await type('.media-form__video', `https://youtu.be/${ID}`);
    await submit();

    expect(fixture.componentInstance.saved).toEqual([
      {
        draft: {
          caption: '',
          date: '2026-12-20',
          kind: 'video',
          skillKey: null,
          videoLink: `https://youtu.be/${ID}`,
        },
        photo: null,
      },
    ]);
  });

  it('should refuse any other video text and a too-long caption, emitting nothing (AC7.3, AC7.4)', async () => {
    await render();
    await chooseKind('media.kinds.video');
    await type('.media-form__video', 'https://vimeo.com/123');
    await type('.media-form__caption', 'a'.repeat(CAPTION_MAX + 1));
    await submit();

    expect(errors()).toEqual(['media.errors.captionTooLong', 'media.errors.videoLinkInvalid']);
    expect(fixture.componentInstance.saved).toEqual([]);
  });

  it('should offer only videos, with an explanation, when photos are off', async () => {
    await render((host) => host.photoEnabled.set(false));

    expect(
      [...element().querySelectorAll('.segmented__option')].map((node) => node.textContent?.trim())
    ).toEqual(['media.kinds.video']);
    expect(query('.media-form__photo')).toBeNull();
    expect(query('.media-form__video')).not.toBeNull();
    expect(query('.media-form__photo-off')?.textContent).toContain('media.photoOff');
  });

  it('should disable save while busy and emit cancel', async () => {
    await render((host) => host.busy.set(true));

    expect(query<HTMLButtonElement>('.media-form__save').disabled).toBe(true);
    query<HTMLButtonElement>('.media-form__cancel').click();
    expect(fixture.componentInstance.cancelled).toBe(1);
  });
});
