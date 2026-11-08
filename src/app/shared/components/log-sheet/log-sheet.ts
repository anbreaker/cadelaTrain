import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { TaskKind } from '@domain/guidance';
import {
  ATTEMPTS_MAX,
  DEFAULT_ATTEMPTS,
  NOTES_MAX,
  Reaction,
  REACTIONS,
  TaskLogDraft,
  validateTaskLogDraft,
} from '@domain/task-log';
import { eventValue } from '@shared/utils/event-value';

type ResultFields = (sheet: LogSheetComponent) => Partial<TaskLogDraft>;

/** The result fields each kind asks for (AC3.2–AC3.4). */
const RESULT_FIELDS: Partial<Record<TaskKind, ResultFields>> = {
  socialization: (sheet) => ({ reaction: sheet.reaction() }),
  training: (sheet) => ({ attempts: sheet.attempts(), successCount: sheet.successCount() }),
};

/**
 * Marks a task done or edits its log: successes as one-tap numbers (Done → number → Save, AC3.8),
 * the reaction for socialization, and optional notes.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-log-sheet',
  styleUrl: './log-sheet.css',
  templateUrl: './log-sheet.html',
})
export class LogSheetComponent {
  readonly busy = input(false);
  readonly canRemove = input(false);
  /** The log being edited; `null` for a new one. */
  readonly initial = input<null | TaskLogDraft>(null);
  readonly kind = input.required<TaskKind>();

  readonly saved = output<TaskLogDraft>();
  readonly cancelled = output<void>();
  readonly removed = output<void>();

  readonly attempts = linkedSignal(() => this.initial()?.attempts ?? DEFAULT_ATTEMPTS);
  readonly successCount = linkedSignal(() => this.initial()?.successCount);
  readonly reaction = linkedSignal(() => this.initial()?.reaction);
  readonly notes = linkedSignal(() => this.initial()?.notes ?? '');

  protected readonly notesMax = NOTES_MAX;
  protected readonly reactions = REACTIONS;
  protected readonly isTraining = computed(() => this.kind() === 'training');
  protected readonly isSocialization = computed(() => this.kind() === 'socialization');
  protected readonly successOptions = computed(() =>
    Array.from({ length: this.attempts() + 1 }, (_, count) => count)
  );
  protected readonly draft = computed((): TaskLogDraft => ({
    ...RESULT_FIELDS[this.kind()]?.(this),
    notes: this.notes(),
  }));
  protected readonly canSave = computed(
    () => !this.busy() && validateTaskLogDraft(this.kind(), this.draft()).length === 0
  );

  protected changeAttempts(step: number): void {
    const attempts = Math.min(Math.max(this.attempts() + step, 1), ATTEMPTS_MAX);
    this.attempts.set(attempts);
    const successes = this.successCount();
    if (successes !== undefined && successes > attempts) this.successCount.set(attempts);
  }

  protected chooseSuccesses(count: number): void {
    this.successCount.set(count);
  }

  protected chooseReaction(reaction: Reaction): void {
    this.reaction.set(reaction);
  }

  protected changeNotes(event: Event): void {
    this.notes.set(eventValue(event));
  }

  protected save(): void {
    if (this.canSave()) this.saved.emit(this.draft());
  }
}
