import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { DogRepository } from '@data/dog.repository';
import { daysUntil, isIsoDate, madridToday } from '@domain/dates';
import { DOG_LIMITS, DogDraft, Environment, validateDogDraft } from '@domain/dog';
import {
  SegmentedControlComponent,
  SegmentOption,
} from '@shared/components/segmented-control/segmented-control';
import { eventValue } from '@shared/utils/event-value';
import { pluralKey } from '@shared/utils/plural-key';

import { errorsByField } from '../dog-error-keys';

type SleepPlace = 'indoors' | 'outdoors';

const SLEEP_OPTIONS: readonly SegmentOption<SleepPlace>[] = [
  { labelKey: 'dog.indoors', value: 'indoors' },
  { labelKey: 'dog.outdoors', value: 'outdoors' },
];

const ENVIRONMENT_OPTIONS: readonly SegmentOption<Environment>[] = [
  { labelKey: 'dog.rural', value: 'rural' },
  { labelKey: 'dog.urban', value: 'urban' },
];

const SAVE_FAILED_KEY = 'common.errors.saveFailed';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedControlComponent, TranslocoDirective],
  selector: 'app-register-dog-page',
  styleUrl: './register-dog.page.css',
  templateUrl: './register-dog.page.html',
})
export class RegisterDogPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly dogs = inject(DogRepository);
  private readonly language = inject(LanguageStore);
  private readonly now = inject(NOW);

  private readonly today = madridToday(this.now());

  private readonly _arrivalDate = signal('');
  private readonly _birthDate = signal('');
  private readonly _breed = signal('');
  private readonly _environment = signal<Environment>('urban');
  private readonly _name = signal('');
  private readonly _pending = signal(false);
  private readonly _saveFailed = signal(false);
  private readonly _sleepPlace = signal<SleepPlace>('indoors');
  private readonly _submitted = signal(false);

  private readonly draft = computed((): DogDraft => ({
    arrivalDate: this._arrivalDate(),
    birthDate: this._birthDate(),
    breed: this._breed(),
    environment: this._environment(),
    name: this._name(),
    notes: '',
    sleepsOutdoors: this._sleepPlace() === 'outdoors',
  }));
  private readonly errorCodes = computed(() => validateDogDraft(this.draft(), this.today));

  protected readonly limits = DOG_LIMITS;
  protected readonly sleepOptions = SLEEP_OPTIONS;
  protected readonly environmentOptions = ENVIRONMENT_OPTIONS;
  protected readonly isOwner = this.session.isOwner;
  protected readonly name = this._name.asReadonly();
  protected readonly breed = this._breed.asReadonly();
  protected readonly birthDate = this._birthDate.asReadonly();
  protected readonly arrivalDate = this._arrivalDate.asReadonly();
  protected readonly sleepPlace = this._sleepPlace.asReadonly();
  protected readonly environment = this._environment.asReadonly();
  protected readonly pending = this._pending.asReadonly();
  protected readonly fieldErrors = computed(() =>
    this._submitted() ? errorsByField(this.errorCodes()) : {}
  );
  protected readonly alertKey = computed(() => (this._saveFailed() ? SAVE_FAILED_KEY : null));
  /** Days until a future arrival, or `null` when the date is missing or already reached. */
  protected readonly countdown = computed(() => {
    const arrival = this._arrivalDate();
    const days = isIsoDate(arrival) ? daysUntil(arrival, this.today) : 0;
    return days > 0
      ? { days, key: pluralKey('dog.arrivesIn', days, this.language.currentLang()) }
      : null;
  });

  protected setName(event: Event): void {
    this._name.set(eventValue(event));
  }

  protected setBreed(event: Event): void {
    this._breed.set(eventValue(event));
  }

  protected setBirthDate(event: Event): void {
    this._birthDate.set(eventValue(event));
  }

  protected setArrivalDate(event: Event): void {
    this._arrivalDate.set(eventValue(event));
  }

  protected setSleepPlace(place: SleepPlace): void {
    this._sleepPlace.set(place);
  }

  protected setEnvironment(environment: Environment): void {
    this._environment.set(environment);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this._submitted.set(true);
    const household = this.session.household();
    if (this.errorCodes().length > 0 || this._pending() || !household) return;

    this._pending.set(true);
    this._saveFailed.set(false);
    try {
      // The session sees the new dog and redirects to today's screen on its own.
      await this.dogs.create(household.id, this.draft(), this.today);
    } catch {
      this._saveFailed.set(true);
      this._pending.set(false);
    }
  }
}
