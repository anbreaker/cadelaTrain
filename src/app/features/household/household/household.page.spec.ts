import { of, Subject, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { NOW } from '@core/time/now';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { TaskLogRepository } from '@data/task-log.repository';
import { Dog } from '@domain/dog';
import { Household } from '@domain/household';
import { TaskLog } from '@domain/task-log';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { HouseholdPageComponent } from './household.page';

const household: Household = {
  id: 'h1',
  locale: 'es',
  memberIds: ['ana', 'jess'],
  members: {
    ana: { displayName: 'Ana', role: 'owner' },
    jess: { displayName: 'Jéssica', role: 'member' },
  },
  name: 'Finca El Encinar',
  ownerId: 'ana',
  timezone: 'Europe/Madrid',
};

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

const sitLog: TaskLog = {
  attempts: 10,
  doneAt: new Date('2026-12-20T07:05:00Z'),
  doneBy: 'jess',
  guidanceDate: '2026-12-20',
  id: 'l1',
  kind: 'training',
  notes: 'Se sentó a la primera',
  skillKey: 'sit',
  successCount: 8,
  taskId: 'session1',
};

const pending: Invitation = {
  email: 'luis@example.com',
  householdId: 'h1',
  householdName: 'Finca El Encinar',
  invitedBy: 'ana',
};

describe('HouseholdPageComponent', () => {
  let session: FakeSession;
  let invitations$: Subject<Invitation[]>;
  let households: { invite: ReturnType<typeof vi.fn>; watchInvitations: ReturnType<typeof vi.fn> };
  let taskLogs: {
    watchAll: ReturnType<typeof vi.fn>;
    watchSocialization: ReturnType<typeof vi.fn>;
  };

  const render = async (): Promise<ComponentFixture<HouseholdPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [HouseholdPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: HouseholdRepository, useValue: households },
        { provide: TaskLogRepository, useValue: taskLogs },
        { provide: NOW, useValue: () => new Date('2026-12-20T09:00:00Z') },
      ],
    });
    const fixture = TestBed.createComponent(HouseholdPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<HouseholdPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  const invite = async (
    fixture: ComponentFixture<HouseholdPageComponent>,
    email: string
  ): Promise<void> => {
    const input = element(fixture).querySelector<HTMLInputElement>('input[type="email"]');
    if (!input) throw new Error('email input missing');
    input.value = email;
    input.dispatchEvent(new Event('input'));
    element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  const rows = (fixture: ComponentFixture<HouseholdPageComponent>): string[] =>
    Array.from(element(fixture).querySelectorAll('.member-list__row')).map((row) =>
      (row.textContent ?? '').replace(/\s+/g, ' ').trim()
    );

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.profile.set({
      displayName: 'Ana',
      email: 'ana@example.com',
      locale: 'es',
      uid: 'ana',
    });
    session.set.household.set(household);
    invitations$ = new Subject<Invitation[]>();
    households = {
      invite: vi.fn(async () => 'invited'),
      watchInvitations: vi.fn(() => invitations$),
    };
    taskLogs = {
      watchAll: vi.fn(() => of([sitLog])),
      watchSocialization: vi.fn(() => of([])),
    };
  });

  describe('notes export', () => {
    let saved: Blob | undefined;
    let fileName: string | undefined;

    beforeEach(() => {
      saved = undefined;
      fileName = undefined;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        saved = blob;
        return 'blob:notes';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        fileName = this.download;
      });
    });

    afterEach(() => vi.restoreAllMocks());

    it('should download every log of the dog as a dated notes file', async () => {
      session.set.dog.set(dela);
      const fixture = await render();
      element(fixture).querySelector<HTMLButtonElement>('.household__export')?.click();
      await fixture.whenStable();

      expect(taskLogs.watchAll).toHaveBeenCalledWith('h1', 'd1');
      expect(fileName).toBe('dela-notes-2026-12-20.md');
      expect(await saved?.text()).toContain('Jéssica · training · sit');
      expect(await saved?.text()).toContain('Se sentó a la primera');
    });

    it('should say when the notes could not be read and download nothing', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      session.set.dog.set(dela);
      taskLogs.watchAll.mockReturnValueOnce(throwError(() => new Error('offline')));
      const fixture = await render();
      element(fixture).querySelector<HTMLButtonElement>('.household__export')?.click();
      await fixture.whenStable();

      expect(saved).toBeUndefined();
      expect(element(fixture).querySelector('.household__export-error')?.textContent).toContain(
        'household.notes.failed'
      );
    });

    it('should not offer the export before the puppy is registered', async () => {
      const fixture = await render();

      expect(element(fixture).querySelector('.household__export')).toBeNull();
    });
  });

  it('should list the members with their role and the pending invitations (AC1.3)', async () => {
    const fixture = await render();
    invitations$.next([pending]);
    await fixture.whenStable();

    expect(households.watchInvitations).toHaveBeenCalledWith('h1');
    expect(rows(fixture)).toEqual([
      'Ana household.you household.status.owner',
      'Jéssica household.status.member',
      'luis@example.com household.status.pending',
    ]);
  });

  it('should reject an invalid email without storing anything (AC1.3)', async () => {
    const fixture = await render();

    await invite(fixture, 'luis@');

    expect(households.invite).not.toHaveBeenCalled();
    expect(element(fixture).querySelector('.field__error')?.textContent).toContain(
      'household.errors.emailInvalid'
    );
  });

  it('should store the invitation and send the sign-in link to that email (AC1.3)', async () => {
    const fixture = await render();

    await invite(fixture, ' Luis@Example.com ');

    expect(households.invite).toHaveBeenCalledWith(
      'h1',
      'Finca El Encinar',
      'luis@example.com',
      'ana'
    );
    expect(session.sendInvitationLink).toHaveBeenCalledWith('luis@example.com');
    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain(
      'household.invited'
    );
  });

  it('should say the person was already invited and not send the link again (AC1.3)', async () => {
    households.invite.mockResolvedValueOnce('alreadyInvited');
    const fixture = await render();

    await invite(fixture, 'luis@example.com');

    expect(session.sendInvitationLink).not.toHaveBeenCalled();
    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain(
      'household.alreadyInvited'
    );
  });

  it('should explain when the invitation cannot be sent', async () => {
    households.invite.mockRejectedValueOnce(new Error('offline'));
    const fixture = await render();

    await invite(fixture, 'luis@example.com');

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'household.errors.inviteFailed'
    );
  });

  it('should not offer invitations to a member who is not the owner', async () => {
    session.set.isOwner.set(false);
    const fixture = await render();

    expect(element(fixture).querySelector('input[type="email"]')).toBeNull();
    expect(households.watchInvitations).not.toHaveBeenCalled();
  });
});
