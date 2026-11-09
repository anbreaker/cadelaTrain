import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { Dog } from '@domain/dog';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { PlanPageComponent } from './plan.page';

const dela: Dog = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  id: 'd1',
  name: 'Dela',
  notes: '',
  planWeek: 3,
  sleepsOutdoors: true,
};

describe('PlanPageComponent', () => {
  let session: FakeSession;

  const render = async (): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      imports: [PlanPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
      ],
    });
    const fixture = TestBed.createComponent(PlanPageComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const weeks = (element: HTMLElement): HTMLDetailsElement[] =>
    Array.from(element.querySelectorAll<HTMLDetailsElement>('details.plan__week'));

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.dog.set(dela);
  });

  it('should list the eight weeks of the plan', async () => {
    const element = await render();

    expect(weeks(element)).toHaveLength(8);
    expect(element.querySelector('h1')?.textContent).toContain('plan.title');
  });

  it("should open and highlight only the dog's current week", async () => {
    const element = await render();
    const all = weeks(element);

    expect(all.filter((week) => week.open)).toEqual([all[2]]);
    expect(all.filter((week) => week.classList.contains('plan__week--current'))).toEqual([all[2]]);
    expect(all[2].querySelector('.plan__current')?.textContent).toContain('plan.current');
    expect(all[0].querySelector('.plan__current')).toBeNull();
  });

  it('should show the objective, how and ready-when texts of a week', async () => {
    const week3 = weeks(await render())[2];

    expect(week3.querySelector('summary')?.textContent).toContain(
      'catalog.planWeeks.week3.objective'
    );
    expect(week3.querySelector('.plan__how')?.textContent).toContain('catalog.planWeeks.week3.how');
    expect(week3.querySelector('.plan__ready-when')?.textContent).toContain(
      'catalog.planWeeks.week3.readyWhen'
    );
  });

  it('should list the key skills of a week with their cue words', async () => {
    const week8 = weeks(await render())[7];
    const skills = Array.from(week8.querySelectorAll<HTMLElement>('.plan__skill'));

    expect(skills).toHaveLength(3);
    expect(skills[0].querySelector('.plan__skill-name')?.textContent).toContain(
      'catalog.skills.come.name'
    );
    expect(skills[0].querySelector('.plan__skill-cue')?.textContent).toContain(
      'catalog.skills.come.cue'
    );
  });

  it('should show a typical day of each week as read-only task cards grouped by slot', async () => {
    const week3 = weeks(await render())[2];
    const slots = Array.from(week3.querySelectorAll<HTMLElement>('.plan__slot'));

    expect(
      slots.map((slot) => slot.querySelector('.plan__slot-title')?.textContent?.trim())
    ).toEqual(['slots.morning', 'slots.midday', 'slots.afternoon', 'slots.night']);
    expect(week3.querySelectorAll('app-task-card').length).toBeGreaterThan(0);
    expect(week3.querySelector('.task-card__mark')).toBeNull();
  });
});
