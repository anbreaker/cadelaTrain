import { Subject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { Household } from '@domain/household';
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

  const render = async (): Promise<ComponentFixture<HouseholdPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [HouseholdPageComponent, translocoTesting()],
      providers: [
        { provide: AuthSessionStore, useValue: session },
        { provide: HouseholdRepository, useValue: households },
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
