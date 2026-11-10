import { catchError, combineLatest, Observable, of, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { LOCALE_BY_LANG } from '@core/const/lang.const';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { MediaRepository } from '@data/media.repository';
import { CLOUDINARY_CLOUD_NAME, PhotoUploadService } from '@data/photo-upload.service';
import { TaskLogRepository } from '@data/task-log.repository';
import { WeeklyReviewRepository } from '@data/weekly-review.repository';
import { preparationChecklist } from '@domain/catalog';
import { IsoDate, madridToday } from '@domain/dates';
import { Media } from '@domain/media';
import {
  PREPARATION_WEEK,
  REVIEW_NOTES_MAX,
  ReviewWeek,
  reviewWeek,
  reviewWeekOf,
  validateWeeklyReviewDraft,
  WeeklyReview,
  WeeklyReviewDraft,
  weeklySummary,
} from '@domain/weekly-review';
import { MediaListComponent } from '@shared/components/media-list/media-list';
import { mediaDayViews } from '@shared/components/media-list/media-list-view';
import { PreparationListComponent } from '@shared/components/preparation-list/preparation-list';
import { eventValue } from '@shared/utils/event-value';

interface DogKey {
  dogId: string;
  householdId: string;
}

type SaveState = 'failed' | 'idle' | 'saved' | 'saving';

const sameDog = (a: DogKey | null, b: DogKey | null): boolean =>
  a?.dogId === b?.dogId && a?.householdId === b?.householdId;

const sameWeek = (a: null | ReviewWeek, b: null | ReviewWeek): boolean =>
  a?.start === b?.start && a?.end === b?.end;

/** "9,8" or "9.8" → 9.8; empty → `null`; anything else → `NaN`, which validation rejects. */
const parseWeight = (text: string): null | number =>
  text.trim() === '' ? null : Number(text.trim().replace(',', '.'));

/**
 * The weekly review (H5): one week since the arrival at a time, from the current week back to week
 * 0. What she does well, what is hard and the new socialization come from the logs; weight and
 * notes are written by any member. Weeks from 1 show their photos and videos per day (AC7.5). Week
 * 0, before the arrival, shows the preparation checklist, notes and a link to the plan.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MediaListComponent, PreparationListComponent, RouterLink, TranslocoDirective],
  selector: 'app-weekly-page',
  styleUrl: './weekly.page.css',
  templateUrl: './weekly.page.html',
})
export class WeeklyPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly language = inject(LanguageStore);
  private readonly taskLogRepository = inject(TaskLogRepository);
  private readonly reviews = inject(WeeklyReviewRepository);
  private readonly mediaRepository = inject(MediaRepository);
  private readonly uploads = inject(PhotoUploadService);
  protected readonly cloudName = inject(CLOUDINARY_CLOUD_NAME);
  private readonly today = madridToday(inject(NOW)());

  private readonly dogKey = computed(
    (): DogKey | null => {
      const household = this.session.household();
      const dog = this.session.dog();
      return household && dog ? { dogId: dog.id, householdId: household.id } : null;
    },
    { equal: sameDog }
  );
  /** Form field, `null` until edited: it then follows the stored review. */
  private readonly _notes = signal<null | string>(null);
  private readonly _saveState = signal<SaveState>('idle');
  private readonly _submitted = signal(false);
  /** `null` until the member moves to another week: the page follows the current week. */
  private readonly _week = signal<null | number>(null);
  /** Form field, `null` until edited: it then follows the stored review. */
  private readonly _weight = signal<null | string>(null);

  private readonly logs = toSignal(
    this.watch((key) => this.taskLogRepository.watchAll(key.householdId, key.dogId)),
    { initialValue: null }
  );
  private readonly socialLogs = toSignal(
    this.watch((key) => this.taskLogRepository.watchSocialization(key.householdId, key.dogId)),
    { initialValue: null }
  );

  protected readonly dog = this.session.dog;
  protected readonly notesMax = REVIEW_NOTES_MAX;
  protected readonly readFailed = signal(false);
  protected readonly saveState = this._saveState.asReadonly();

  /** The week in progress: `PREPARATION_WEEK` before the arrival. */
  protected readonly currentWeek = computed(() => {
    const dog = this.dog();
    return dog ? reviewWeekOf(dog.arrivalDate, this.today) : null;
  });
  protected readonly week = computed(() => this._week() ?? this.currentWeek());
  protected readonly isPreparation = computed(() => this.week() === PREPARATION_WEEK);
  protected readonly preparationItems = preparationChecklist();
  protected readonly canGoBack = computed(
    () => (this.week() ?? PREPARATION_WEEK) > PREPARATION_WEEK
  );
  protected readonly canGoForward = computed(() => {
    const week = this.week();
    const current = this.currentWeek();
    return week !== null && current !== null && week < current;
  });

  private readonly stored = toSignal(
    combineLatest([toObservable(this.dogKey), toObservable(this.week)]).pipe(
      switchMap(([key, week]) =>
        key && week !== null
          ? this.reviews
              .watchWeek(key.householdId, key.dogId, week)
              .pipe(catchError(() => this.readError<null | WeeklyReview>(null)))
          : of(null)
      )
    ),
    { initialValue: null }
  );

  protected readonly summary = computed(() => {
    const dog = this.dog();
    const week = this.week();
    return dog && week !== null && week !== PREPARATION_WEEK
      ? weeklySummary({
          dog,
          logs: this.logs() ?? [],
          socialization: this.socialLogs() ?? [],
          today: this.today,
          week,
        })
      : null;
  });

  private readonly formatDate = computed(() => {
    const format = new Intl.DateTimeFormat(LOCALE_BY_LANG[this.language.currentLang()], {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return (date: IsoDate): string => format.format(new Date(`${date}T00:00:00Z`));
  });
  /** Week 0 shows the arrival date; any other week its first and last day. */
  protected readonly dates = computed(() => {
    const format = this.formatDate();
    const week = this.summary()?.week;
    const dog = this.dog();
    if (this.isPreparation() && dog)
      return { arrival: format(dog.arrivalDate), end: '', start: '' };
    return week ? { arrival: null, end: format(week.end), start: format(week.start) } : null;
  });

  protected readonly notes = computed(() => this._notes() ?? this.stored()?.notes ?? '');
  protected readonly weight = computed(() => {
    const stored = this.stored()?.weightKg;
    return this._weight() ?? (stored === null || stored === undefined ? '' : String(stored));
  });
  /** Week 0 has no weight: she is not home yet. */
  private readonly draft = computed((): WeeklyReviewDraft => ({
    notes: this.notes(),
    weightKg: this.isPreparation() ? null : parseWeight(this.weight()),
  }));
  protected readonly errorKeys = computed(() =>
    this._submitted()
      ? validateWeeklyReviewDraft(this.draft()).map((code) => `weekly.errors.${code}`)
      : []
  );

  /** Who changed the review last, and when (AC5.3). */
  protected readonly edited = computed(() => {
    const review = this.stored();
    if (!review) return null;
    const format = new Intl.DateTimeFormat(LOCALE_BY_LANG[this.language.currentLang()], {
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      timeZone: 'Europe/Madrid',
    });
    return {
      date: format.format(review.updatedAt),
      name: this.session.household()?.members[review.updatedBy]?.displayName ?? '—',
    };
  });

  /** The dates of the shown week; `null` on week 0, which has no media. */
  private readonly mediaWeek = computed(
    (): null | ReviewWeek => {
      const dog = this.dog();
      const week = this.week();
      return dog && week !== null && week !== PREPARATION_WEEK
        ? reviewWeek(dog.arrivalDate, week)
        : null;
    },
    { equal: sameWeek }
  );
  private readonly media = toSignal(
    combineLatest([toObservable(this.dogKey), toObservable(this.mediaWeek)]).pipe(
      switchMap(([key, week]) =>
        key && week
          ? this.mediaRepository
              .watchRange(key.householdId, key.dogId, week.start, week.end)
              .pipe(catchError(() => this.readError<Media[]>([])))
          : of([])
      )
    ),
    { initialValue: [] }
  );
  protected readonly mediaDays = computed(() =>
    mediaDayViews(this.media(), {
      formatDate: this.formatDate(),
      members: this.session.household()?.members ?? {},
      uid: this.session.user()?.uid ?? null,
    })
  );
  protected readonly removeFailed = signal(false);
  protected readonly removingId = signal<null | string>(null);

  protected goToWeek(offset: number): void {
    const week = this.week();
    if (week === null) return;
    this._week.set(week + offset);
    this._notes.set(null);
    this._weight.set(null);
    this._submitted.set(false);
    this._saveState.set('idle');
  }

  protected setNotes(event: Event): void {
    this._notes.set(eventValue(event));
    this._saveState.set('idle');
  }

  protected setWeight(event: Event): void {
    this._weight.set(eventValue(event));
    this._saveState.set('idle');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this._submitted.set(true);
    const key = this.dogKey();
    const week = this.week();
    const uid = this.session.profile()?.uid;
    const draft = this.draft();
    if (!key || week === null || !uid || this._saveState() === 'saving') return;
    if (validateWeeklyReviewDraft(draft).length > 0) return;

    this._saveState.set('saving');
    try {
      await this.reviews.save(
        key.householdId,
        key.dogId,
        { draft, measuredOn: this.today, weekNumber: week },
        uid,
        this.stored()?.weightKg ?? null
      );
      this._saveState.set('saved');
    } catch {
      this._saveState.set('failed');
    }
  }

  /** The author deletes their own photo or video (AC7.6). */
  protected async removeMedia(media: Media): Promise<void> {
    const key = this.dogKey();
    if (!key || this.removingId()) return;
    this.removingId.set(media.id);
    this.removeFailed.set(false);
    try {
      await this.uploads.removeMedia(key.householdId, key.dogId, media);
    } catch (error) {
      console.warn('Weekly: could not delete the media', error);
      this.removeFailed.set(true);
    } finally {
      this.removingId.set(null);
    }
  }

  private readError<T>(fallback: T): Observable<T> {
    this.readFailed.set(true);
    return of(fallback);
  }

  /** Follows the household dog; a read failure shows a notice and leaves the lists empty. */
  private watch<T>(read: (key: DogKey) => Observable<T>): Observable<null | T> {
    return toObservable(this.dogKey).pipe(
      switchMap((key) =>
        key ? read(key).pipe(catchError(() => this.readError<null | T>(null))) : of(null)
      )
    );
  }
}
