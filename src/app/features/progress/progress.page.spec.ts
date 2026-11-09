import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { TaskLogRepository } from '@data/task-log.repository';
import { SKILLS } from '@domain/catalog';
import { Dog } from '@domain/dog';
import { Household } from '@domain/household';
import { SocializationLog, TaskLog } from '@domain/task-log';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { ProgressPageComponent } from './progress.page';

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
  memberIds: ['alice'],
  members: { alice: { displayName: 'Jéssica', role: 'owner' } },
  name: 'Casa',
  ownerId: 'alice',
  timezone: 'Europe/Madrid',
};

const sitLog: TaskLog = {
  attempts: 10,
  doneAt: new Date('2026-12-20T08:00:00Z'),
  doneBy: 'alice',
  guidanceDate: '2026-12-20',
  id: 'l1',
  kind: 'training',
  notes: '',
  skillKey: 'sit',
  successCount: 9,
  taskId: 't1',
};

describe('ProgressPageComponent', () => {
  let session: FakeSession;
  let logs$: Observable<TaskLog[]>;
  let social$: Observable<SocializationLog[]>;

  const render = async (): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      imports: [ProgressPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        { provide: NOW, useValue: () => new Date('2026-12-20T10:00:00Z') },
        {
          provide: TaskLogRepository,
          useValue: { watchAll: () => logs$, watchSocialization: () => social$ },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProgressPageComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const cards = (element: HTMLElement): HTMLElement[] =>
    Array.from(element.querySelectorAll<HTMLElement>('.skill-card'));

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.dog.set(dela);
    session.set.household.set(home);
    logs$ = of([sitLog]);
    social$ = of([]);
  });

  it('should show one card per skill with its name (AC4.1)', async () => {
    const element = await render();

    expect(cards(element)).toHaveLength(SKILLS.length);
    expect(element.querySelector('.skill-card__name')?.textContent).toContain(
      'catalog.skills.name.name'
    );
  });

  it('should show the rate, mastery, sessions and 14-day trend of a trained skill (AC4.2, AC4.3)', async () => {
    const sit = cards(await render())[1];

    expect(sit.classList).toContain('skill-card--mastered');
    expect(sit.querySelector('.skill-card__badge')?.textContent).toContain(
      'progress.skills.mastered'
    );
    expect(sit.querySelector('.skill-card__rate')?.textContent).toContain('progress.skills.rate');
    expect(sit.querySelector('.skill-card__sessions')?.textContent).toContain(
      'progress.skills.sessions.one'
    );
    expect(sit.querySelectorAll('.skill-card__bar')).toHaveLength(14);
  });

  it('should show the empty state for a skill never trained (AC4.2)', async () => {
    const name = cards(await render())[0];

    expect(name.querySelector('.skill-card__empty')?.textContent).toContain(
      'progress.skills.empty'
    );
    expect(name.querySelector('.skill-card__trend')).toBeNull();
    expect(name.querySelector('.skill-card__badge')).toBeNull();
  });

  it('should say the logs could not be read and keep the empty cards', async () => {
    logs$ = throwError(() => new Error('offline'));
    const element = await render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'progress.errors.readFailed'
    );
    expect(cards(element)).toHaveLength(SKILLS.length);
  });
});
