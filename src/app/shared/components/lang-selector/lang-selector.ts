import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { LANG_FLAGS, LANG_NAMES, SUPPORTED_LANGS, SupportedLang } from '@core/const/lang.const';

interface LangPill {
  code: string;
  flag: string;
  lang: SupportedLang;
  name: string;
}

const PILLS: readonly LangPill[] = SUPPORTED_LANGS.map((lang) => ({
  code: lang.toUpperCase(),
  flag: LANG_FLAGS[lang],
  lang,
  name: LANG_NAMES[lang],
}));

/** UI language as a group of pill buttons (flag + code); the container decides what switching does. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-lang-selector',
  styleUrl: './lang-selector.css',
  templateUrl: './lang-selector.html',
})
export class LangSelectorComponent {
  readonly lang = input.required<SupportedLang>();

  readonly langChange = output<SupportedLang>();

  protected readonly pills = PILLS;
}
