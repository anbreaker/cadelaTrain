import { catchError, Observable, of, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';

import { LOCALE_BY_LANG } from '@core/const/lang.const';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { MediaRepository } from '@data/media.repository';
import {
  CLOUDINARY_CLOUD_NAME,
  PhotoUploadError,
  PhotoUploadService,
} from '@data/photo-upload.service';
import { IsoDate, madridToday } from '@domain/dates';
import { Media, MediaKind } from '@domain/media';
import { MediaFormComponent, MediaSubmission } from '@shared/components/media-form/media-form';
import { MediaListComponent } from '@shared/components/media-list/media-list';
import { mediaDayViews } from '@shared/components/media-list/media-list-view';

interface DayKey {
  dogId: string;
  householdId: string;
}

const sameDay = (a: DayKey | null, b: DayKey | null): boolean =>
  a?.dogId === b?.dogId && a?.householdId === b?.householdId;

/** An upload error names its own message; anything else is a generic save failure. */
const saveErrorKey = (error: unknown): string =>
  error instanceof PhotoUploadError ? `media.errors.${error.code}` : 'media.errors.saveFailed';

type Saver = (key: DayKey, submission: MediaSubmission, uid: string) => Promise<unknown>;

/**
 * Photos and videos of the day on Today (H7): the Madrid day's media, newest first, and a form to
 * add one. A photo is uploaded to Cloudinary and then recorded (AC7.2); a video link is stored as
 * its id (AC7.3). The author deletes their own items (AC7.6).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MediaFormComponent, MediaListComponent, TranslocoDirective],
  selector: 'app-today-media',
  styleUrl: './today-media.css',
  templateUrl: './today-media.html',
})
export class TodayMediaComponent {
  private readonly language = inject(LanguageStore);
  private readonly session = inject(AuthSessionStore);
  private readonly repository = inject(MediaRepository);
  private readonly uploads = inject(PhotoUploadService);

  protected readonly cloudName = inject(CLOUDINARY_CLOUD_NAME);
  protected readonly today = madridToday(inject(NOW)());

  private readonly dayKey = computed(
    (): DayKey | null => {
      const household = this.session.household();
      const dog = this.session.dog();
      return household && dog ? { dogId: dog.id, householdId: household.id } : null;
    },
    { equal: sameDay }
  );
  private readonly media = toSignal(this.watchDay(), { initialValue: null });

  private readonly savers: Readonly<Record<MediaKind, Saver>> = {
    photo: async ({ dogId, householdId }, { draft, photo }, uid) => {
      if (!photo) throw new PhotoUploadError('photoMissing');
      const uploaded = await this.uploads.uploadPhoto(householdId, uid, photo);
      const { caption, date, skillKey } = draft;
      return this.repository.addPhoto(
        householdId,
        dogId,
        { caption, date, skillKey, ...uploaded },
        uid
      );
    },
    video: ({ dogId, householdId }, { draft }, uid) =>
      this.repository.addVideo(householdId, dogId, draft, uid),
  };

  protected readonly days = computed(() =>
    mediaDayViews(this.media() ?? [], {
      formatDate: () => '',
      members: this.session.household()?.members ?? {},
      uid: this.session.user()?.uid ?? null,
    })
  );
  protected readonly isEmpty = computed(() => this.media()?.length === 0);
  protected readonly photoEnabled = this.cloudName !== '';
  protected readonly errorKey = signal<null | string>(null);
  protected readonly formOpen = signal(false);
  protected readonly readFailed = signal(false);
  protected readonly removingId = signal<null | string>(null);
  /** Date of the last item saved; one dated another day lives in that week's review, not here. */
  private readonly savedDate = signal<IsoDate | null>(null);
  protected readonly savedMessage = computed(() => {
    const date = this.savedDate();
    if (!date) return null;
    return date === this.today
      ? { key: 'media.saved', params: {} }
      : { key: 'media.savedFor', params: { date: this.formatDate()(date) } };
  });
  protected readonly saving = signal(false);

  private readonly formatDate = computed(() => {
    const format = new Intl.DateTimeFormat(LOCALE_BY_LANG[this.language.currentLang()], {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return (date: IsoDate): string => format.format(new Date(`${date}T00:00:00Z`));
  });

  protected openForm(): void {
    this.errorKey.set(null);
    this.savedDate.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.errorKey.set(null);
    this.formOpen.set(false);
  }

  protected async add(submission: MediaSubmission): Promise<void> {
    const key = this.dayKey();
    const uid = this.session.user()?.uid;
    if (!key || !uid || this.saving()) return;
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      await this.savers[submission.draft.kind](key, submission, uid);
      this.formOpen.set(false);
      this.savedDate.set(submission.draft.date);
    } catch (error) {
      console.warn('Today: could not add the media', error);
      this.errorKey.set(saveErrorKey(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(media: Media): Promise<void> {
    const key = this.dayKey();
    if (!key || this.removingId()) return;
    this.removingId.set(media.id);
    this.errorKey.set(null);
    try {
      await this.uploads.removeMedia(key.householdId, key.dogId, media);
    } catch (error) {
      console.warn('Today: could not delete the media', error);
      this.errorKey.set('media.errors.deleteFailed');
    } finally {
      this.removingId.set(null);
    }
  }

  /** Follows the household dog; a read failure shows a notice and leaves the list empty. */
  private watchDay(): Observable<Media[] | null> {
    return toObservable(this.dayKey).pipe(
      switchMap((key) =>
        key
          ? this.repository.watchRange(key.householdId, key.dogId, this.today, this.today).pipe(
              catchError((error: unknown) => {
                console.warn('Today: could not read the media', error);
                this.readFailed.set(true);
                return of(null);
              })
            )
          : of(null)
      )
    );
  }
}
