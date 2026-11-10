import { catchError, Observable, of, switchMap } from 'rxjs';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { LOCALE_BY_LANG } from '@core/const/lang.const';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { DogRepository } from '@data/dog.repository';
import { GuidanceRepository } from '@data/guidance.repository';
import { TaskLogRepository } from '@data/task-log.repository';
import { preparationChecklist } from '@domain/catalog';
import { addDays, ageInWeeks, daysUntil, IsoDate, madridToday } from '@domain/dates';
import { Dog } from '@domain/dog';
import { DailyGuidance, healthMessageKey } from '@domain/guidance';
import { planWeekFor } from '@domain/plan-week';
import { WINDOW_DAYS } from '@domain/progress';
import { TaskLogDraft } from '@domain/task-log';
import { templateGuidance } from '@domain/template-guidance';
import { LogSheetComponent } from '@shared/components/log-sheet/log-sheet';
import { PreparationListComponent } from '@shared/components/preparation-list/preparation-list';
import { TaskCardComponent } from '@shared/components/task-card/task-card';
import { pluralKey } from '@shared/utils/plural-key';

import { TodayMediaComponent } from './today-media';
import { DayCard, slotViews } from './today-view';

/** The task whose log sheet is open: a new completion, or my latest log being edited. */
interface OpenSheet {
  card: DayCard;
  mode: 'edit' | 'new';
}

interface DayKey {
  dogId: string;
  householdId: string;
}

const sameDay = (a: DayKey | null, b: DayKey | null): boolean =>
  a?.dogId === b?.dogId && a?.householdId === b?.householdId;

/**
 * Today's guide for the puppy (H2): the stored guidance of the Madrid date, or the template built
 * from the bundled catalogs while none exists, so the day is never empty. Before the arrival it
 * shows the countdown and the preparation checklist instead. Tasks are logged, edited and deleted
 * from the card's sheet (H3). On opening, it moves the dog to the next plan week once the
 * current week's key skills are mastered (`planWeekFor`) and says so. Once she is home, the day's
 * photos and videos follow the tasks (H7).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LogSheetComponent,
    PreparationListComponent,
    TaskCardComponent,
    TodayMediaComponent,
    TranslocoDirective,
  ],
  selector: 'app-today-page',
  styleUrl: './today.page.css',
  templateUrl: './today.page.html',
})
export class TodayPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly language = inject(LanguageStore);
  private readonly transloco = inject(TranslocoService);
  private readonly guidanceRepository = inject(GuidanceRepository);
  private readonly taskLogRepository = inject(TaskLogRepository);
  private readonly dogRepository = inject(DogRepository);
  private readonly now = inject(NOW)();

  private readonly today = madridToday(this.now);
  private readonly dayKey = computed(
    (): DayKey | null => {
      const household = this.session.household();
      const dog = this.session.dog();
      return household && dog ? { dogId: dog.id, householdId: household.id } : null;
    },
    { equal: sameDay }
  );
  /** `undefined` while loading; `null` when no guidance is stored (or it cannot be read). */
  private readonly stored = toSignal(
    this.watch((key) => this.guidanceRepository.watchDay(key.householdId, key.dogId, this.today)),
    { initialValue: undefined }
  );
  private readonly logs = toSignal(
    this.watch((key) => this.taskLogRepository.watchDay(key.householdId, key.dogId, this.today)),
    { initialValue: null }
  );
  /** The logs of the evaluation window (last 7 Madrid days), all the week advance rates need. */
  private readonly windowLogs = toSignal(
    this.watch((key) =>
      this.taskLogRepository.watchSince(
        key.householdId,
        key.dogId,
        addDays(this.today, 1 - WINDOW_DAYS)
      )
    ),
    { initialValue: null }
  );
  /** The week advance is tried at most once per load, so the updated dog never loops writes. */
  private advanceTried = false;
  /** Re-renders the template guidance once the active language's translations are loaded. */
  private readonly translation = toSignal(this.transloco.selectTranslation());

  protected readonly dog = this.session.dog;
  protected readonly dateLabel = computed(() =>
    new Intl.DateTimeFormat(LOCALE_BY_LANG[this.language.currentLang()], {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Madrid',
      weekday: 'long',
    }).format(this.now)
  );
  protected readonly age = computed(() => {
    const dog = this.dog();
    const weeks = dog ? ageInWeeks(dog.birthDate, this.today) : 0;
    return { key: pluralKey('today.ageWeeks', weeks, this.language.currentLang()), weeks };
  });
  /** Days left before the arrival; 0 on the day itself, `null` once the puppy is home. */
  protected readonly daysLeft = computed(() => {
    const dog = this.dog();
    const days = dog ? daysUntil(dog.arrivalDate, this.today) : -1;
    return days >= 0 ? days : null;
  });
  protected readonly countdownKey = computed(() =>
    pluralKey('today.countdown', this.daysLeft() ?? 0, this.language.currentLang())
  );
  protected readonly preparationItems = preparationChecklist();

  protected readonly guidance = computed((): DailyGuidance | null => {
    const stored = this.stored();
    const dog = this.dog();
    if (stored) return stored;
    if (stored === undefined || !dog) return null;
    return this.template(dog, this.today);
  });
  /** Before the arrival: the plan's first day, built from the catalogs and shown read-only. */
  protected readonly preview = computed(() => {
    const dog = this.dog();
    if (!dog || !this.daysLeft()) return null;
    const guidance = this.template(dog, dog.arrivalDate);
    return {
      slots: slotViews(guidance, {
        formatTime: () => '',
        logs: [],
        members: {},
        now: this.now,
        uid: null,
      }),
      summary: guidance.summary,
    };
  });
  protected readonly healthKey = computed(() =>
    healthMessageKey(this.guidance()?.healthFlag ?? null)
  );
  protected readonly slots = computed(() => {
    const guidance = this.guidance();
    const time = new Intl.DateTimeFormat(LOCALE_BY_LANG[this.language.currentLang()], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    });
    return guidance
      ? slotViews(guidance, {
          formatTime: (date) => time.format(date),
          logs: this.logs() ?? [],
          members: this.session.household()?.members ?? {},
          now: this.now,
          uid: this.session.user()?.uid ?? null,
        })
      : [];
  });

  /** The week the dog has just moved to, for the notice; `null` when there was no advance. */
  protected readonly advancedTo = signal<null | number>(null);
  protected readonly logFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly sheet = signal<null | OpenSheet>(null);
  protected readonly sheetTaskId = computed(() => this.sheet()?.card.task.id ?? null);
  protected readonly sheetInitial = computed(() => {
    const sheet = this.sheet();
    return sheet?.mode === 'edit' ? (sheet.card.edit?.draft ?? null) : null;
  });

  constructor() {
    effect(() => {
      const key = this.dayKey();
      const dog = this.dog();
      const logs = this.windowLogs();
      if (this.advanceTried || !key || !dog || !logs) return;
      const week = planWeekFor({
        birthDate: dog.birthDate,
        logs,
        planWeek: dog.planWeek,
        today: this.today,
      });
      if (week <= dog.planWeek) return;
      this.advanceTried = true;
      void this.advance(key, week);
    });
  }

  protected openSheet(card: DayCard, mode: OpenSheet['mode']): void {
    this.logFailed.set(false);
    this.sheet.set({ card, mode });
  }

  protected closeSheet(): void {
    this.sheet.set(null);
  }

  protected save(draft: TaskLogDraft): Promise<void> {
    return this.write((key, { card, mode }, uid) =>
      mode === 'edit' && card.edit
        ? this.taskLogRepository.update(key.householdId, key.dogId, card.edit.log, draft)
        : this.taskLogRepository.log(
            key.householdId,
            key.dogId,
            { draft, guidanceDate: this.today, task: card.task },
            uid
          )
    );
  }

  protected remove(): Promise<void> {
    return this.write((key, { card }) =>
      card.edit
        ? this.taskLogRepository.remove(key.householdId, key.dogId, card.edit.log)
        : Promise.resolve()
    );
  }

  /** Runs one write for the open sheet; closes it on success, keeps it open with an error otherwise. */
  private async write(
    run: (key: DayKey, sheet: OpenSheet, uid: string) => Promise<unknown>
  ): Promise<void> {
    const key = this.dayKey();
    const sheet = this.sheet();
    const uid = this.session.user()?.uid;
    if (!key || !sheet || !uid || this.saving()) return;
    this.saving.set(true);
    this.logFailed.set(false);
    try {
      await run(key, sheet, uid);
      this.sheet.set(null);
    } catch (error) {
      console.warn('Today: could not save the log', error);
      this.logFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async advance(key: DayKey, week: number): Promise<void> {
    try {
      await this.dogRepository.advancePlanWeek(key.householdId, key.dogId, week);
      this.advancedTo.set(week);
    } catch (error) {
      console.warn('Today: could not advance the plan week', error);
    }
  }

  /** Follows the household dog; a read failure falls back to the template or no done marks. */
  private watch<T>(read: (key: DayKey) => Observable<T>): Observable<null | T> {
    return toObservable(this.dayKey).pipe(
      switchMap((key) =>
        key
          ? read(key).pipe(
              catchError((error: unknown) => {
                console.warn('Today: could not read the day', error);
                return of(null);
              })
            )
          : of(null)
      )
    );
  }

  /** Template guidance in the active language; re-runs once its translations are loaded. */
  private template(dog: Dog, date: IsoDate): DailyGuidance {
    this.translation();
    return templateGuidance({
      date,
      dog,
      locale: this.language.currentLang(),
      translate: (key, params) => this.transloco.translate(key, params),
    });
  }
}
