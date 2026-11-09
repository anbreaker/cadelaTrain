import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { TaskKind, taskKindLabelKey } from '@domain/guidance';

export interface TaskCardView {
  /** My latest log is still editable (AC3.6). */
  canEdit: boolean;
  /** Completions today (AC3.5). */
  count: number;
  /** Latest completion: who (`null` once they left the household) and local time. */
  done: null | { at: string; by: null | string };
  durationMin: null | number;
  id: string;
  instructions: string;
  kind: TaskKind;
  title: string;
}

const KIND_ICONS: Record<TaskKind, string> = {
  care: '🛡️',
  feeding: '🍽️',
  potty: '🌱',
  socialization: '🤝',
  training: '🎯',
};

/** One task of the day (AC2.2, AC2.3) with its Done and Edit actions (AC3.1, AC3.6). */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-task-card',
  styleUrl: './task-card.css',
  templateUrl: './task-card.html',
})
export class TaskCardComponent {
  readonly card = input.required<TaskCardView>();
  /** A preview: the task is shown without the Done and Edit actions. */
  readonly readOnly = input(false);

  readonly edited = output<void>();
  readonly marked = output<void>();

  protected readonly icon = computed(() => KIND_ICONS[this.card().kind]);
  protected readonly kindKey = computed(() => taskKindLabelKey(this.card().kind));
  protected readonly showCount = computed(() => this.card().count > 1);
  protected readonly doneKey = computed(() =>
    this.card().done?.by ? 'today.doneBy' : 'today.doneAt'
  );
}
