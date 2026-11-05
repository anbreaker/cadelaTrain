import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { LOCALE_BY_LANG } from '@core/const/lang.const';
import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { ageInWeeks, daysUntil, madridToday } from '@domain/dates';
import { pluralKey } from '@shared/utils/plural-key';

/**
 * H1 placeholder: the puppy, its arrival countdown (AC2.5 text) and an honest empty state.
 * Daily guidance replaces the empty state with H6; no tasks are invented here.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-today-page',
  styleUrl: './today.page.css',
  templateUrl: './today.page.html',
})
export class TodayPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly language = inject(LanguageStore);
  private readonly now = inject(NOW)();

  private readonly today = madridToday(this.now);

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
}
