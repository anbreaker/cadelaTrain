import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { Invitation } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  selector: 'app-invitations-page',
  styleUrl: './invitations.page.css',
  templateUrl: './invitations.page.html',
})
export class InvitationsPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly households = inject(HouseholdRepository);

  /** Household id being joined, so only that card shows progress. */
  private readonly _failed = signal(false);
  private readonly _joining = signal<null | string>(null);

  protected readonly invitations = this.session.invitations;
  protected readonly joining = this._joining.asReadonly();
  protected readonly failed = this._failed.asReadonly();

  protected async join(invitation: Invitation): Promise<void> {
    const profile = this.session.profile();
    if (!profile || this._joining()) return;

    this._joining.set(invitation.householdId);
    this._failed.set(false);
    try {
      // Once joined, the session finds the household and leaves this screen on its own.
      await this.households.acceptInvitation(invitation.householdId, {
        displayName: profile.displayName,
        email: profile.email,
        uid: profile.uid,
      });
    } catch {
      this._failed.set(true);
      this._joining.set(null);
    }
  }
}
