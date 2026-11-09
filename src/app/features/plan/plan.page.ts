import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { templateGuidance } from '@domain/template-guidance';
import { SlotView } from '@features/today/today-view';
import { TaskCardComponent } from '@shared/components/task-card/task-card';

import { PlanWeekView, planWeekViews, typicalDay, weekStart } from './plan-view';

interface PlanWeekWithDay extends PlanWeekView {
  day: SlotView[];
}

/**
 * The whole training plan, read-only: every week's objective, how to work it, when she is ready
 * and its key skills with their cue words, plus a typical day built from the bundled catalogs. The
 * dog's current week is highlighted and open.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaskCardComponent, TranslocoDirective],
  selector: 'app-plan-page',
  styleUrl: './plan.page.css',
  templateUrl: './plan.page.html',
})
export class PlanPageComponent {
  private readonly language = inject(LanguageStore);
  private readonly transloco = inject(TranslocoService);
  protected readonly dog = inject(AuthSessionStore).dog;

  /** Re-renders the typical days once the active language's translations are loaded. */
  private readonly translation = toSignal(this.transloco.selectTranslation());

  protected readonly weeks = computed((): PlanWeekWithDay[] => {
    const dog = this.dog();
    if (!dog) return [];
    this.translation();
    const locale = this.language.currentLang();
    const translate = (key: string, params?: Record<string, number | string>): string =>
      this.transloco.translate(key, params);
    return planWeekViews(dog.planWeek).map((week) => ({
      ...week,
      day: typicalDay(
        templateGuidance({
          date: weekStart(dog.arrivalDate, week.week),
          dog: { ...dog, planWeek: week.week },
          locale,
          translate,
        })
      ),
    }));
  });
}
