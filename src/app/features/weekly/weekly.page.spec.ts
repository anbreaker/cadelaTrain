import { Observable, of } from 'rxjs';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { TaskLogRepository } from '@data/task-log.repository';
import { WeeklyReviewRepository } from '@data/weekly-review.repository';
import { PREPARATION_ITEMS } from '@domain/catalog';
import { Dog } from '@domain/dog';
import { Household } from '@domain/household';
import { SocializationLog, TaskLog } from '@domain/task-log';
import { WeeklyReview } from '@domain/weekly-review';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { WeeklyPageComponent } from './weekly.page';

const dela: Dog = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  id: 'd1',
  name: 'Dela',
  notes: '',
  planWeek: 1,
  sleepsOutdoors: true,
};

const home: Household = {
  id: 'h1',
  locale: 'es',
  memberIds: ['alice', 'bob'],
  members: {
    alice: { displayName: 'Jéssica', role: 'owner' },
    bob: { displayName: 'Javier', role: 'member' },
  },
  name: 'Casa',
  ownerId: 'alice',
  timezone: 'Europe/Madrid',
};

const training = (skillKey: string, guidanceDate: string, successCount: number): TaskLog => ({
  attempts: 10,
  doneAt: new Date(`${guidanceDate}T08:00:00Z`),
  doneBy: 'alice',
  guidanceDate,
  id: `${skillKey}-${guidanceDate}`,
  kind: 'training',
  notes: '',
  skillKey,
  successCount,
  taskId: 't3',
});

const stored: WeeklyReview = {
  notes: 'Muy buena semana',
  updatedAt: new Date('2026-12-19T18:00:00Z'),
  updatedBy: 'bob',
  weekNumber: 2,
  weightKg: 9.4,
};

describe('WeeklyPageComponent', () => {
  let session: FakeSession;
  let logs$: Observable<TaskLog[]>;
  let social$: Observable<SocializationLog[]>;
  let reviews: { save: ReturnType<typeof vi.fn>; watchWeek: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<WeeklyPageComponent>;

  const render = async (now = '2026-12-20T10:00:00Z'): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      imports: [WeeklyPageComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        { provide: NOW, useValue: () => new Date(now) },
        {
          provide: TaskLogRepository,
          useValue: { watchAll: () => logs$, watchSocialization: () => social$ },
        },
        { provide: WeeklyReviewRepository, useValue: reviews },
      ],
    });
    fixture = TestBed.createComponent(WeeklyPageComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const text = (element: HTMLElement, selector: string): string =>
    element.querySelector(selector)?.textContent ?? '';

  const items = (element: HTMLElement, selector: string): string[] =>
    Array.from(element.querySelectorAll(`${selector} li`)).map(
      (item) => item.textContent?.trim() ?? ''
    );

  const click = async (element: HTMLElement, selector: string): Promise<void> => {
    element.querySelector<HTMLElement>(selector)?.click();
    await fixture.whenStable();
  };

  const type = async (element: HTMLElement, selector: string, value: string): Promise<void> => {
    const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!input) throw new Error(`${selector} missing`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  const submit = async (element: HTMLElement): Promise<void> => {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.dog.set(dela);
    session.set.household.set(home);
    session.set.profile.set({
      displayName: 'Jéssica',
      email: 'j@example.com',
      locale: 'es',
      uid: 'alice',
    });
    logs$ = of([]);
    social$ = of([]);
    reviews = {
      save: vi.fn(async () => undefined),
      watchWeek: vi.fn((_household: string, _dog: string, week: number) =>
        of(week === 2 ? stored : null)
      ),
    };
  });

  describe('week 0, before the arrival', () => {
    it('should open on week 0 before the arrival, with the checklist, notes and plan link', async () => {
      const element = await render('2026-12-01T10:00:00Z');

      expect(reviews.watchWeek).toHaveBeenCalledWith('h1', 'd1', 0);
      expect(text(element, '.weekly__title')).toContain('weekly.preparationTitle');
      expect(element.querySelectorAll('.preparation-list__item')).toHaveLength(
        PREPARATION_ITEMS.length
      );
      expect(element.querySelector('.weekly__notes')).not.toBeNull();
      expect(element.querySelector('.weekly__weight')).toBeNull();
      expect(element.querySelector('.weekly__does-well')).toBeNull();
      expect(element.querySelector('a.weekly__plan-link')?.getAttribute('href')).toBe('/plan');
      expect(element.querySelector<HTMLButtonElement>('.weekly__previous')?.disabled).toBe(true);
      expect(element.querySelector<HTMLButtonElement>('.weekly__next')?.disabled).toBe(true);
    });

    it('should go back from week 1 to week 0', async () => {
      const element = await render('2026-12-12T10:00:00Z');

      await click(element, '.weekly__previous');

      expect(reviews.watchWeek).toHaveBeenLastCalledWith('h1', 'd1', 0);
      expect(text(element, '.weekly__title')).toContain('weekly.preparationTitle');
      expect(element.querySelector<HTMLButtonElement>('.weekly__next')?.disabled).toBe(false);
    });

    it('should save the notes of week 0 without weight', async () => {
      const element = await render('2026-12-01T10:00:00Z');

      await type(element, '.weekly__notes', 'Cita con el veterinario el día 9');
      await submit(element);

      expect(reviews.save).toHaveBeenCalledWith(
        'h1',
        'd1',
        {
          draft: { notes: 'Cita con el veterinario el día 9', weightKg: null },
          measuredOn: '2026-12-01',
          weekNumber: 0,
        },
        'alice',
        null
      );
    });
  });

  it('should open on the current week with its dates, plan week, age and objective (AC5.1)', async () => {
    const element = await render();

    expect(reviews.watchWeek).toHaveBeenCalledWith('h1', 'd1', 2);
    expect(text(element, '.weekly__title')).toContain('weekly.title');
    expect(text(element, '.weekly__dates')).toContain('17');
    expect(text(element, '.weekly__dates')).toContain('23');
    expect(text(element, '.weekly__meta')).toContain('weekly.planWeek');
    expect(text(element, '.weekly__meta')).toContain('weekly.age');
    expect(text(element, '.weekly__objective')).toContain('catalog.planWeeks.week1.objective');
  });

  it('should fill in what she does well, what is hard and new socialization (AC5.2)', async () => {
    logs$ = of([training('name', '2026-12-18', 9), training('sit', '2026-12-19', 3)]);
    social$ = of([
      {
        doneAt: new Date('2026-12-18T10:00:00Z'),
        doneBy: 'alice',
        id: 's1',
        itemKey: 'peopleMen',
        notes: '',
        reaction: 'calm',
      },
    ]);
    const element = await render();

    expect(items(element, '.weekly__does-well')).toEqual(['catalog.skills.name.name']);
    expect(items(element, '.weekly__struggles')).toEqual(['catalog.skills.sit.name']);
    expect(items(element, '.weekly__socialization')).toEqual([
      'catalog.socialization.items.peopleMen.label',
    ]);
  });

  it('should say when a list is empty (AC5.2)', async () => {
    const element = await render();

    expect(text(element, '.weekly__does-well')).toContain('weekly.none');
  });

  it('should go back to previous weeks down to week 0, never past the current one (AC5.4)', async () => {
    const element = await render();
    const next = (): HTMLButtonElement | null =>
      element.querySelector<HTMLButtonElement>('.weekly__next');
    const previous = (): HTMLButtonElement | null =>
      element.querySelector<HTMLButtonElement>('.weekly__previous');

    expect(next()?.disabled).toBe(true);

    await click(element, '.weekly__previous');

    expect(reviews.watchWeek).toHaveBeenLastCalledWith('h1', 'd1', 1);
    expect(next()?.disabled).toBe(false);

    await click(element, '.weekly__previous');

    expect(reviews.watchWeek).toHaveBeenLastCalledWith('h1', 'd1', 0);
    expect(previous()?.disabled).toBe(true);
  });

  it('should show the stored notes, weight and last editor of the week (AC5.3)', async () => {
    const element = await render();

    expect(element.querySelector<HTMLInputElement>('.weekly__weight')?.value).toBe('9.4');
    expect(element.querySelector<HTMLTextAreaElement>('.weekly__notes')?.value).toBe(
      'Muy buena semana'
    );
    expect(text(element, '.weekly__edited')).toContain('weekly.editedBy');
  });

  it('should save notes and weight as the signed-in member (AC5.3)', async () => {
    const element = await render();

    await type(element, '.weekly__weight', '9,8');
    await type(element, '.weekly__notes', 'Ya viene a la primera');
    await submit(element);

    expect(reviews.save).toHaveBeenCalledWith(
      'h1',
      'd1',
      {
        draft: { notes: 'Ya viene a la primera', weightKg: 9.8 },
        measuredOn: '2026-12-20',
        weekNumber: 2,
      },
      'alice',
      9.4
    );
    expect(text(element, '[role="status"]')).toContain('weekly.saved');
  });

  it('should save a week without weight when the field is empty (AC5.3)', async () => {
    reviews.watchWeek.mockReturnValue(of(null));
    const element = await render();

    await type(element, '.weekly__notes', 'Sin pesar');
    await submit(element);

    expect(reviews.save).toHaveBeenCalledWith(
      'h1',
      'd1',
      expect.objectContaining({ draft: { notes: 'Sin pesar', weightKg: null } }),
      'alice',
      null
    );
  });

  it('should refuse a weight out of range without saving (AC5.3)', async () => {
    const element = await render();

    await type(element, '.weekly__weight', '300');
    await submit(element);

    expect(reviews.save).not.toHaveBeenCalled();
    expect(text(element, '.field__error')).toContain('weekly.errors.weightOutOfRange');
  });

  it('should explain when the review cannot be saved', async () => {
    reviews.save.mockRejectedValueOnce(new Error('offline'));
    const element = await render();

    await submit(element);

    expect(text(element, '[role="alert"]')).toContain('common.errors.saveFailed');
  });
});
