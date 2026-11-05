import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { TaskKind, taskKindLabelKey } from '@domain/guidance';

export interface TaskCardView {
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

/** One task of the day (AC2.2, AC2.3). */
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

  protected readonly icon = computed(() => KIND_ICONS[this.card().kind]);
  protected readonly kindKey = computed(() => taskKindLabelKey(this.card().kind));
  protected readonly doneKey = computed(() =>
    this.card().done?.by ? 'today.doneBy' : 'today.doneAt'
  );
}
