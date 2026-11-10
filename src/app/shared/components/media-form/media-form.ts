import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { SKILLS } from '@domain/catalog';
import { IsoDate } from '@domain/dates';
import {
  CAPTION_MAX,
  MediaDraft,
  MediaKind,
  validateMediaDraft,
  validatePhotoFile,
} from '@domain/media';
import {
  SegmentedControlComponent,
  SegmentOption,
} from '@shared/components/segmented-control/segmented-control';
import { eventValue } from '@shared/utils/event-value';

/** What the form hands to its container: the fields, plus the chosen file of a photo. */
export interface MediaSubmission {
  draft: MediaDraft;
  /** `null` for a video. */
  photo: File | null;
}

const KIND_OPTIONS: Readonly<Record<MediaKind, SegmentOption<MediaKind>>> = {
  photo: { labelKey: 'media.kinds.photo', value: 'photo' },
  video: { labelKey: 'media.kinds.video', value: 'video' },
};

const SKILL_OPTIONS = SKILLS.map(({ key }) => ({ key, nameKey: `catalog.skills.${key}.name` }));

/**
 * Adds a photo (camera or gallery, AC7.2) or an unlisted YouTube link (AC7.3) to a day, with a date,
 * an optional caption and an optional skill (AC7.4). Errors show only after a save attempt, and
 * nothing is emitted while any remains.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedControlComponent, TranslocoDirective],
  selector: 'app-media-form',
  styleUrl: './media-form.css',
  templateUrl: './media-form.html',
})
export class MediaFormComponent {
  readonly busy = input(false);
  /** Without a Cloudinary cloud name only videos can be added. */
  readonly photoEnabled = input(true);
  /** Madrid date: the default and the latest date offered. */
  readonly today = input.required<IsoDate>();

  readonly saved = output<MediaSubmission>();
  readonly cancelled = output<void>();

  readonly kind = linkedSignal((): MediaKind => (this.photoEnabled() ? 'photo' : 'video'));
  readonly date = linkedSignal(() => this.today());
  readonly caption = signal('');
  readonly photo = signal<File | null>(null);
  readonly skillKey = signal<null | string>(null);
  private readonly submitted = signal(false);
  readonly videoLink = signal('');

  protected readonly captionMax = CAPTION_MAX;
  protected readonly skills = SKILL_OPTIONS;
  protected readonly kindOptions = computed(() =>
    this.photoEnabled() ? [KIND_OPTIONS.photo, KIND_OPTIONS.video] : [KIND_OPTIONS.video]
  );
  protected readonly isPhoto = computed(() => this.kind() === 'photo');

  private readonly draft = computed((): MediaDraft => ({
    caption: this.caption(),
    date: this.date(),
    kind: this.kind(),
    skillKey: this.skillKey(),
    videoLink: this.isPhoto() ? '' : this.videoLink(),
  }));
  private readonly errors = computed(() => [
    ...validateMediaDraft(this.draft()),
    ...(this.isPhoto() ? validatePhotoFile(this.photo()) : []),
  ]);
  protected readonly errorKeys = computed(() =>
    this.submitted() ? this.errors().map((code) => `media.errors.${code}`) : []
  );

  protected chooseKind(kind: MediaKind): void {
    this.kind.set(kind);
  }

  protected choosePhoto(event: Event): void {
    this.photo.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected changeVideoLink(event: Event): void {
    this.videoLink.set(eventValue(event));
  }

  protected changeDate(event: Event): void {
    this.date.set(eventValue(event));
  }

  protected changeCaption(event: Event): void {
    this.caption.set(eventValue(event));
  }

  protected changeSkill(event: Event): void {
    this.skillKey.set(eventValue(event) || null);
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.busy() || this.errors().length > 0) return;
    this.saved.emit({ draft: this.draft(), photo: this.isPhoto() ? this.photo() : null });
  }
}
