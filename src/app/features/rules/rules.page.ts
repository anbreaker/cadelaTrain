import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { PRINCIPLES, SKILLS } from '@domain/catalog';

interface CueRow {
  cueKey: string;
  labelKey: string;
}

/** Spoken words that are not tied to one skill (`catalog.cues.*`). */
const EXTRA_CUES = ['praise', 'no'] as const;

/**
 * The household's shared rules, read-only: the spoken word for each cue in the active language and
 * the training principles, so everyone who trains the puppy says and does the same.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-rules-page',
  styleUrl: './rules.page.css',
  templateUrl: './rules.page.html',
})
export class RulesPageComponent {
  protected readonly dog = inject(AuthSessionStore).dog;
  protected readonly cues: readonly CueRow[] = [
    ...SKILLS.map(({ key }) => ({
      cueKey: `catalog.skills.${key}.cue`,
      labelKey: `catalog.skills.${key}.name`,
    })),
    ...EXTRA_CUES.map((key) => ({ cueKey: `catalog.cues.${key}`, labelKey: `rules.cues.${key}` })),
  ];
  protected readonly principleKeys = PRINCIPLES.map(({ key }) => `catalog.principles.${key}`);
}
