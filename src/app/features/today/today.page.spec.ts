import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { LanguageStore } from '@core/store/language.store';
import { NOW } from '@core/time/now';
import { Dog } from '@domain/dog';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { TodayPageComponent } from './today.page';

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

describe('TodayPageComponent', () => {
  let session: FakeSession;

  const render = async (now: string): Promise<ComponentFixture<TodayPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [TodayPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: LanguageStore, useValue: { currentLang: signal('es') } },
        { provide: NOW, useValue: () => new Date(now) },
      ],
    });
    const fixture = TestBed.createComponent(TodayPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<TodayPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.dog.set(dela);
  });

  it('should count down the days until the puppy arrives (AC2.5)', async () => {
    const fixture = await render('2026-11-04T10:00:00Z');

    expect(element(fixture).querySelector('.today__countdown-number')?.textContent?.trim()).toBe(
      '36'
    );
    expect(element(fixture).querySelector('.today__countdown-text')?.textContent).toContain(
      'today.countdown.other'
    );
  });

  it('should say the puppy arrives today on the arrival date', async () => {
    const fixture = await render('2026-12-10T10:00:00Z');

    expect(element(fixture).querySelector('.today__countdown')).toBeNull();
    expect(element(fixture).textContent).toContain('today.arrivesToday');
  });

  it('should drop the countdown once the puppy has arrived', async () => {
    const fixture = await render('2026-12-20T10:00:00Z');

    expect(element(fixture).querySelector('.today__countdown')).toBeNull();
    expect(element(fixture).textContent).not.toContain('today.arrivesToday');
  });

  it('should say daily guidance comes later instead of showing tasks', async () => {
    const fixture = await render('2026-12-20T10:00:00Z');

    expect(element(fixture).querySelector('.today__empty')?.textContent).toContain(
      'today.emptyTitle'
    );
    expect(element(fixture).querySelector('article')).toBeNull();
  });
});
