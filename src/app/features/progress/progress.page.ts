import { catchError, Observable, of, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';

import { LOCALE_BY_LANG } from '@core/const/lang.const';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { TaskLogRepository } from '@data/task-log.repository';
import { IsoDate, madridToday } from '@domain/dates';
import { pluralKey } from '@shared/utils/plural-key';

import { skillCards } from './progress-view';

interface DogKey {
  dogId: string;
  householdId: string;
}

const sameDog = (a: DogKey | null, b: DogKey | null): boolean =>
  a?.dogId === b?.dogId && a?.householdId === b?.householdId;

/** The puppy's progress (H4): each skill's success rate, mastery, trend and sessions. */
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
