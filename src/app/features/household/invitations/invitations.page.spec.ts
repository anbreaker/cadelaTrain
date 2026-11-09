import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { InvitationsPageComponent } from './invitations.page';

const invitation: Invitation = {
  email: 'jess@example.com',
  householdId: 'h1',
  householdName: 'Finca El Encinar',
  invitedBy: 'ana',
};

describe('InvitationsPageComponent', () => {
  let session: FakeSession;
  let households: { acceptInvitation: ReturnType<typeof vi.fn> };

  const render = async (): Promise<ComponentFixture<InvitationsPageComponent>> => {
    TestBed.configureTestingModule({
      imports: [InvitationsPageComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AuthSessionStore, useValue: session },
        { provide: HouseholdRepository, useValue: households },
      ],
    });
    const fixture = TestBed.createComponent(InvitationsPageComponent);
    await fixture.whenStable();
    return fixture;
  };

  const element = (fixture: ComponentFixture<InvitationsPageComponent>): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.profile.set({
      displayName: 'Jéssica',
      email: 'jess@example.com',
      locale: 'pt',
      uid: 'jess',
    });
    session.set.invitations.set([invitation]);
    households = { acceptInvitation: vi.fn(async () => undefined) };
  });

  it('should show each invitation with the household name (AC1.4)', async () => {
    const fixture = await render();

    expect(element(fixture).querySelectorAll('.invitation')).toHaveLength(1);
    expect(element(fixture).querySelector('.invitation__title')?.textContent).toContain(
      'invitations.invitedTo'
    );
  });

  it('should join the household as this user (AC1.4)', async () => {
    const fixture = await render();

    element(fixture).querySelector<HTMLButtonElement>('.invitation .button--primary')?.click();
    await fixture.whenStable();

    expect(households.acceptInvitation).toHaveBeenCalledWith('h1', {
      displayName: 'Jéssica',
      email: 'jess@example.com',
      uid: 'jess',
    });
  });

  it('should explain when joining fails', async () => {
    households.acceptInvitation.mockRejectedValueOnce(new Error('denied'));
    const fixture = await render();

    element(fixture).querySelector<HTMLButtonElement>('.invitation .button--primary')?.click();
    await fixture.whenStable();

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'invitations.errors.joinFailed'
    );
  });

  it('should let the user create their own household instead', async () => {
    const fixture = await render();

    expect(element(fixture).querySelector('a[href="/household/new"]')).not.toBeNull();
  });
});
