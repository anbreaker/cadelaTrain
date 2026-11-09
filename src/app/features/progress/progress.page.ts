import { catchError, Observable, of, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';

import { LOCALE_BY_LANG } from '@core/const/lang.const';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { TaskLogRepository } from '@data/task-log.repository';
import { SOCIALIZATION_ITEMS } from '@domain/catalog';
import { IsoDate, madridToday } from '@domain/dates';
import { weekAdvance } from '@domain/plan-week';
import { daysToSocializationDeadline, socializationStatus } from '@domain/progress';
import { pluralKey } from '@shared/utils/plural-key';

import { nextWeekView, skillCards, socializationGroups } from './progress-view';

interface DogKey {
  dogId: string;
  householdId: string;
}

const sameDog = (a: DogKey | null, b: DogKey | null): boolean =>
  a?.dogId === b?.dogId && a?.householdId === b?.householdId;

/**
 * The puppy's progress (H4): each skill's success rate, mastery, trend and sessions, and the
 * socialization checklist with the days left until 16 weeks. It also shows what is missing for the
 * next plan week (`weekAdvance`).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-progress-page',
  styleUrl: './progress.page.css',
  templateUrl: './progress.page.html',
})
export class ProgressPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly language = inject(LanguageStore);
  private readonly taskLogRepository = inject(TaskLogRepository);
  private readonly today = madridToday(inject(NOW)());

  private readonly dogKey = computed(
    (): DogKey | null => {
      const household = this.session.household();
      const dog = this.session.dog();
      return household && dog ? { dogId: dog.id, householdId: household.id } : null;
    },
    { equal: sameDog }
  );
  private readonly logs = toSignal(
    this.watch((key) => this.taskLogRepository.watchAll(key.householdId, key.dogId)),
    { initialValue: null }
  );
  private readonly socialLogs = toSignal(
    this.watch((key) => this.taskLogRepository.watchSocialization(key.householdId, key.dogId)),
    { initialValue: null }
  );
  private readonly statuses = computed(() =>
    socializationStatus(SOCIALIZATION_ITEMS, this.socialLogs() ?? [])
  );
  private readonly formatDate = computed(() => {
    const format = new Intl.DateTimeFormat(LOCALE_BY_LANG[this.language.currentLang()], {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return (date: IsoDate): string => format.format(new Date(`${date}T00:00:00Z`));
  });

  protected readonly dog = this.session.dog;
  protected readonly readFailed = signal(false);
  protected readonly cards = computed(() =>
    skillCards(this.logs() ?? [], this.today, this.formatDate()).map((card) => ({
      ...card,
      sessionsKey: pluralKey(
        'progress.skills.sessions',
        card.sessions,
        this.language.currentLang()
      ),
    }))
  );

  protected readonly nextWeek = computed(() => {
    const dog = this.dog();
    return dog
      ? nextWeekView(
          weekAdvance({
            birthDate: dog.birthDate,
            logs: this.logs() ?? [],
            planWeek: dog.planWeek,
            today: this.today,
          })
        )
      : null;
  });

  protected readonly groups = computed(() =>
    socializationGroups(this.statuses(), this.session.household()?.members ?? {})
  );
  protected readonly pending = computed(() => {
    const count = this.statuses().filter((status) => !status.done).length;
    return {
      count,
      key: pluralKey('progress.socialization.pendingCount', count, this.language.currentLang()),
    };
  });
  /** Days left until 16 weeks of age, with the text that reads them (AC4.5). */
  protected readonly deadline = computed(() => {
    const dog = this.dog();
    const days = dog ? daysToSocializationDeadline(dog.birthDate, this.today) : 0;
    return {
      days,
      key:
        days > 0
          ? pluralKey('progress.socialization.deadline', days, this.language.currentLang())
          : 'progress.socialization.deadlinePassed',
    };
  });

  /** Follows the household dog; a read failure shows a notice and leaves the cards empty. */
  private watch<T>(read: (key: DogKey) => Observable<T>): Observable<null | T> {
    return toObservable(this.dogKey).pipe(
      switchMap((key) =>
        key
          ? read(key).pipe(
              catchError((error: unknown) => {
                console.warn('Progress: could not read the logs', error);
                this.readFailed.set(true);
                return of(null);
              })
            )
          : of(null)
      )
    );
  }
}
