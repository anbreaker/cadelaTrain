import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { GuidanceRepository } from '@data/guidance.repository';
import { TaskLogRepository } from '@data/task-log.repository';
import { PREPARATION_ITEMS } from '@domain/catalog';
import { Dog } from '@domain/dog';
import { DailyGuidance } from '@domain/guidance';
import { Household } from '@domain/household';
import { TaskLog } from '@domain/task-log';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { TodayPageComponent } from './today.page';

import { vi } from 'vitest';

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

const stored: DailyGuidance = {
  ageWeeks: 9,
  date: '2026-12-20',
  healthFlag: null,
  locale: 'es',
  planWeek: 1,
  source: 'ai',
  summary: 'Stored summary',
  tasks: [
    {
      durationMin: 5,
      id: 't1',
      instructions: 'Stored instructions',
      kind: 'training',
      order: 1,
      skillKey: 'name',
      slot: 'morning',
      title: 'Stored task',
    },
  ],
};

const doneLog: TaskLog = {
  doneAt: new Date('2026-12-20T08:15:00Z'),
  doneBy: 'alice',
  guidanceDate: '2026-12-20',
  id: 'l1',
  kind: 'training',
  notes: '',
  taskId: 't1',
};

describe('TodayPageComponent', () => {
  let session: FakeSession;
  let guidance$: Observable<DailyGuidance | null>;
  let logs$: Observable<TaskLog[]>;
  let watchGuidance: ReturnType<typeof vi.fn>;
  let logs: {
    log: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    watchDay: () => Observable<TaskLog[]>;
  };
  let fixture: ComponentFixture<TodayPageComponent>;

  const render = async (now: string): Promise<HTMLElement> => {
    watchGuidance = vi.fn(() => guidance$);
    TestBed.configureTestingModule({
      imports: [TodayPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        { provide: NOW, useValue: () => new Date(now) },
        { provide: GuidanceRepository, useValue: { watchDay: watchGuidance } },
        { provide: TaskLogRepository, useValue: logs },
      ],
    });
    fixture = TestBed.createComponent(TodayPageComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const text = (element: HTMLElement, selector: string): string =>
    element.querySelector(selector)?.textContent ?? '';

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
    guidance$ = of(null);
    logs$ = of([]);
    logs = {
      log: vi.fn(async () => 'l2'),
      remove: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      watchDay: () => logs$,
    };
  });

  const click = async (element: HTMLElement, selector: string): Promise<void> => {
    element.querySelector<HTMLElement>(selector)?.click();
    await fixture.whenStable();
  };

  it('should mark optional preparation items and explain them', async () => {
    const element = await render('2026-11-04T10:00:00Z');
    const items = Array.from(element.querySelectorAll<HTMLElement>('.today__checklist-item'));
    const cleaning = items.find((item) =>
      item.textContent?.includes('catalog.preparation.cleaning.label')
    );
    const kennel = items.find((item) =>
      item.textContent?.includes('catalog.preparation.kennel.label')
    );

    expect(cleaning?.querySelector('.today__checklist-optional')?.textContent).toContain(
      'today.optional'
    );
    expect(cleaning?.querySelector('.today__checklist-hint')?.textContent).toContain(
      'catalog.preparation.cleaning.hint'
    );
    expect(kennel?.querySelector('.today__checklist-optional')).toBeNull();
    expect(kennel?.querySelector('.today__checklist-hint')).toBeNull();
  });

  it('should count down and show the preparation checklist instead of tasks (AC2.5)', async () => {
    const element = await render('2026-11-04T10:00:00Z');

    expect(text(element, '.today__countdown-number').trim()).toBe('36');
    expect(text(element, '.today__countdown-text')).toContain('today.countdown.other');
    expect(element.querySelectorAll('.today__checklist li')).toHaveLength(PREPARATION_ITEMS.length);
    expect(text(element, '.today__checklist')).toContain('catalog.preparation.kennel.label');
    expect(element.querySelector('app-task-card')).toBeNull();
  });

  it('should show the day on the arrival date, with the arrival note', async () => {
    const element = await render('2026-12-10T10:00:00Z');

    expect(element.querySelector('.today__countdown')).toBeNull();
    expect(element.textContent).toContain('today.arrivesToday');
    expect(element.querySelector('.today__checklist')).toBeNull();
    expect(element.querySelector('app-task-card')).not.toBeNull();
  });

  it("should read the stored guidance of today's Madrid date for the household dog", async () => {
    await render('2026-12-20T10:00:00Z');

    expect(watchGuidance).toHaveBeenCalledWith('h1', 'd1', '2026-12-20');
  });

  it('should show the template guidance when none is stored, never an empty day (AC2.4)', async () => {
    const element = await render('2026-12-20T10:00:00Z');

    expect(text(element, '.today__summary')).toContain('catalog.planWeeks.week1.objective');
    expect(element.querySelectorAll('.today__slot-title')[0]?.textContent).toContain(
      'slots.morning'
    );
    expect(element.querySelectorAll('app-task-card').length).toBeGreaterThan(0);
    expect(element.textContent).not.toContain('today.arrivesToday');
  });

  it('should fall back to the template when the stored guidance cannot be read', async () => {
    guidance$ = throwError(() => new Error('permission-denied'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const element = await render('2026-12-20T10:00:00Z');

    expect(text(element, '.today__summary')).toContain('catalog.planWeeks.week1.objective');
  });

  it('should show the stored summary and tasks by slot, with who did them (AC2.1–AC2.3)', async () => {
    guidance$ = of(stored);
    logs$ = of([doneLog]);

    const element = await render('2026-12-20T10:00:00Z');

    expect(text(element, '.today__summary')).toContain('Stored summary');
    expect(element.querySelectorAll('app-task-card')).toHaveLength(1);
    expect(text(element, '.task-card__done')).toContain('today.doneBy');
    expect(element.querySelector('.today__health')).toBeNull();
  });

  it('should show only the fixed health phrase when a flag is active (AC2.6)', async () => {
    guidance$ = of({ ...stored, healthFlag: 'urgent' });

    const element = await render('2026-12-20T10:00:00Z');
    const banner = element.querySelector('.today__health');

    expect(banner?.textContent?.trim()).toBe('health.vetEmergency');
    expect(banner?.getAttribute('role')).toBe('alert');
  });

  it('should log a training task in three taps: Done, successes, Save (AC3.1, AC3.2, AC3.8)', async () => {
    guidance$ = of(stored);
    const element = await render('2026-12-20T10:00:00Z');

    await click(element, '.task-card__mark');
    await click(element, '.log-sheet__success:nth-child(9)');
    await click(element, '.log-sheet__save');

    expect(logs.log).toHaveBeenCalledWith(
      'h1',
      'd1',
      {
        draft: { attempts: 10, notes: '', successCount: 8 },
        guidanceDate: '2026-12-20',
        task: { id: 't1', kind: 'training', skillKey: 'name' },
      },
      'alice'
    );
    expect(element.querySelector('app-log-sheet')).toBeNull();
  });

  it('should edit and delete my latest log within 24 hours (AC3.6)', async () => {
    guidance$ = of(stored);
    logs$ = of([{ ...doneLog, attempts: 10, successCount: 6 }]);
    const element = await render('2026-12-20T10:00:00Z');

    await click(element, '.task-card__edit');
    await click(element, '.log-sheet__success:nth-child(8)');
    await click(element, '.log-sheet__save');
    await click(element, '.task-card__edit');
    await click(element, '.log-sheet__remove');

    expect(logs.update).toHaveBeenCalledWith(
      'h1',
      'd1',
      { id: 'l1', kind: 'training' },
      { attempts: 10, notes: '', successCount: 7 }
    );
    expect(logs.remove).toHaveBeenCalledWith('h1', 'd1', { id: 'l1', kind: 'training' });
  });

  it('should keep the sheet open and say so when saving fails', async () => {
    guidance$ = of(stored);
    logs.log.mockRejectedValueOnce(new Error('unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = await render('2026-12-20T10:00:00Z');

    await click(element, '.task-card__mark');
    await click(element, '.log-sheet__success:nth-child(9)');
    await click(element, '.log-sheet__save');

    expect(element.querySelector('app-log-sheet')).not.toBeNull();
    expect(element.querySelector('.today__log-error')?.textContent).toContain(
      'log.errors.saveFailed'
    );
  });
});
