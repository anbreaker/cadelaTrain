import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { DogRepository } from '@data/dog.repository';
import { Household } from '@domain/household';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { RegisterDogPageComponent } from './register-dog.page';

const household = { id: 'h1', name: 'Finca', ownerId: 'ana' } as Household;

describe('RegisterDogPageComponent', () => {
  let session: FakeSession;
  let dogs: { create: ReturnType<typeof vi.fn> };

  const render = async (): Promise<ComponentFixture<RegisterDogPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [RegisterDogPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: DogRepository, useValue: dogs },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        // 23:30 UTC on 4 Nov is already 5 Nov in Madrid.
        { provide: NOW, useValue: () => new Date('2026-11-04T23:30:00Z') },
      ],
    });
    const fixture = TestBed.createComponent(RegisterDogPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<RegisterDogPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  const fill = async (
    fixture: ComponentFixture<RegisterDogPageComponent>,
    values: Record<string, string>
  ): Promise<void> => {
    Object.entries(values).forEach(([name, value]) => {
      const input = element(fixture).querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!input) throw new Error(`input ${name} missing`);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    });
    await fixture.whenStable();
  };

  const submit = async (fixture: ComponentFixture<RegisterDogPageComponent>): Promise<void> => {
    element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  const errors = (fixture: ComponentFixture<RegisterDogPageComponent>): string[] =>
    Array.from(element(fixture).querySelectorAll('.field__error')).map((error) =>
      (error.textContent ?? '').trim()
    );

  const pressOption = (
    fixture: ComponentFixture<RegisterDogPageComponent>,
    label: string
  ): void => {
    const button = Array.from(
      element(fixture).querySelectorAll<HTMLButtonElement>('.segmented__option')
    ).find((option) => option.textContent?.trim() === label);
    if (!button) throw new Error(`option ${label} missing`);
    button.click();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.household.set(household);
    dogs = { create: vi.fn(async () => 'd1') };
  });

  it('should require name and both dates before storing anything (AC1.5)', async () => {
    const fixture = await render();

    await submit(fixture);

    expect(dogs.create).not.toHaveBeenCalled();
    expect(errors(fixture)).toEqual([
      'dog.errors.nameRequired',
      'dog.errors.dateInvalid',
      'dog.errors.dateInvalid',
    ]);
  });

  it('should reject a birth date in the future and an arrival before the birth (AC1.5)', async () => {
    const fixture = await render();

    await fill(fixture, { arrivalDate: '2026-11-01', birthDate: '2026-11-06', name: 'Dela' });
    await submit(fixture);

    expect(errors(fixture)).toEqual([
      'dog.errors.birthDateInFuture',
      'dog.errors.arrivalBeforeBirth',
    ]);
    expect(dogs.create).not.toHaveBeenCalled();
  });

  it('should store every field with the Madrid date as today (AC1.5)', async () => {
    const fixture = await render();

    await fill(fixture, {
      arrivalDate: '2026-12-10',
      birthDate: '2026-10-15',
      breed: 'Labrador',
      name: 'Dela',
    });
    pressOption(fixture, 'dog.outdoors');
    pressOption(fixture, 'dog.rural');
    await submit(fixture);

    expect(dogs.create).toHaveBeenCalledWith(
      'h1',
      {
        arrivalDate: '2026-12-10',
        birthDate: '2026-10-15',
        breed: 'Labrador',
        environment: 'rural',
        name: 'Dela',
        notes: '',
        sleepsOutdoors: true,
      },
      '2026-11-05'
    );
  });

  it('should mark the pressed segment', async () => {
    const fixture = await render();

    pressOption(fixture, 'dog.outdoors');
    await fixture.whenStable();

    const pressed = Array.from(element(fixture).querySelectorAll('[aria-pressed="true"]')).map(
      (option) => option.textContent?.trim()
    );
    expect(pressed).toContain('dog.outdoors');
    expect(pressed).not.toContain('dog.indoors');
  });

  it('should show how many days are left until the arrival', async () => {
    const fixture = await render();

    await fill(fixture, { arrivalDate: '2026-12-10' });

    expect(element(fixture).querySelector('.register-dog__countdown')?.textContent).toContain(
      'dog.arrivesIn.other'
    );
  });

  it('should tell a member that the owner registers the puppy', async () => {
    session.set.isOwner.set(false);
    const fixture = await render();

    expect(element(fixture).querySelector('form')).toBeNull();
    expect(element(fixture).textContent).toContain('dog.waitingForOwner');
  });
});
