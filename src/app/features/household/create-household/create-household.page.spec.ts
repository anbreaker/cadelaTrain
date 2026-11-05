import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { HouseholdRepository } from '@data/household.repository';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { CreateHouseholdPageComponent } from './create-household.page';

describe('CreateHouseholdPageComponent', () => {
  let session: FakeSession;
  let households: { create: ReturnType<typeof vi.fn> };

  const render = async (): Promise<ComponentFixture<CreateHouseholdPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [CreateHouseholdPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: HouseholdRepository, useValue: households },
        { provide: LanguageStore, useValue: { currentLang: signal('pt') } },
      ],
    });
    const fixture = TestBed.createComponent(CreateHouseholdPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<CreateHouseholdPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  const typeName = (
    fixture: ComponentFixture<CreateHouseholdPageComponent>,
    name: string
  ): void => {
    const input = element(fixture).querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error('name input missing');
    input.value = name;
    input.dispatchEvent(new Event('input'));
  };

  const submit = async (fixture: ComponentFixture<CreateHouseholdPageComponent>): Promise<void> => {
    element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.profile.set({
      displayName: 'Ana',
      email: 'ana@example.com',
      locale: 'pt',
      uid: 'ana',
    });
    households = { create: vi.fn(async () => 'h1') };
  });

  it('should show the domain validation message and store nothing without a name', async () => {
    const fixture = await render();

    await submit(fixture);

    expect(households.create).not.toHaveBeenCalled();
    expect(element(fixture).querySelector('.field__error')?.textContent).toContain(
      'household.errors.nameRequired'
    );
  });

  it('should create the household with the user as owner and the UI language preselected (AC1.2)', async () => {
    const fixture = await render();

    typeName(fixture, 'Finca El Encinar');
    await submit(fixture);

    expect(households.create).toHaveBeenCalledWith(
      { locale: 'pt', name: 'Finca El Encinar' },
      { displayName: 'Ana', uid: 'ana' }
    );
  });

  it('should use the guidance language the user picks', async () => {
    const fixture = await render();
    const spanish = element(fixture).querySelector<HTMLInputElement>('input[value="es"]');

    typeName(fixture, 'Finca');
    spanish?.click();
    await submit(fixture);

    expect(households.create).toHaveBeenCalledWith(
      { locale: 'es', name: 'Finca' },
      expect.anything()
    );
  });

  it('should explain when saving fails', async () => {
    households.create.mockRejectedValueOnce(new Error('offline'));
    const fixture = await render();

    typeName(fixture, 'Finca');
    await submit(fixture);

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'common.errors.saveFailed'
    );
  });
});
