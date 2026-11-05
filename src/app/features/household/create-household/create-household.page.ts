import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { HouseholdRepository } from '@data/household.repository';
import { HOUSEHOLD_NAME_MAX, Locale, LOCALES, validateHouseholdDraft } from '@domain/household';
import { eventValue } from '@shared/utils/event-value';

import { HOUSEHOLD_ERROR_KEYS } from '../household-error-keys';

const SAVE_FAILED_KEY = 'common.errors.saveFailed';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-create-household-page',
  styleUrl: './create-household.page.css',
  templateUrl: './create-household.page.html',
})
export class CreateHouseholdPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly households = inject(HouseholdRepository);
  private readonly language = inject(LanguageStore);

  private readonly _locale = signal<Locale>(this.language.currentLang());
  private readonly _name = signal('');
  private readonly _pending = signal(false);
  private readonly _saveFailed = signal(false);
  private readonly _submitted = signal(false);

  protected readonly locales = LOCALES;
  protected readonly nameMax = HOUSEHOLD_NAME_MAX;
  protected readonly name = this._name.asReadonly();
  protected readonly locale = this._locale.asReadonly();
  protected readonly pending = this._pending.asReadonly();
  protected readonly errorKeys = computed(() =>
    this._submitted()
      ? validateHouseholdDraft({ locale: this._locale(), name: this._name() }).map(
          (code) => HOUSEHOLD_ERROR_KEYS[code]
        )
      : []
  );
  protected readonly alertKey = computed(() => (this._saveFailed() ? SAVE_FAILED_KEY : null));

  protected setName(event: Event): void {
    this._name.set(eventValue(event));
  }

  protected setLocale(locale: Locale): void {
    this._locale.set(locale);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this._submitted.set(true);
    const profile = this.session.profile();
    if (this.errorKeys().length > 0 || this._pending() || !profile) return;

    this._pending.set(true);
    this._saveFailed.set(false);
    try {
      // The session follows the new household and redirects to the puppy screen on its own.
      await this.households.create(
        { locale: this._locale(), name: this._name() },
        { displayName: profile.displayName, uid: profile.uid }
      );
    } catch {
      this._saveFailed.set(true);
      this._pending.set(false);
    }
  }
}
