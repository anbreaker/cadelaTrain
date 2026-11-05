import { catchError, of, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { Invitation, InviteResult } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { isValidEmail, normalizeEmail } from '@domain/email';
import { MemberListComponent, MemberRow } from '@shared/components/member-list/member-list';
import { eventValue } from '@shared/utils/event-value';

const FEEDBACK_KEY: Record<InviteResult, string> = {
  alreadyInvited: 'household.alreadyInvited',
  invited: 'household.invited',
};

interface InviteFeedback {
  email: string;
  key: string;
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MemberListComponent, TranslocoDirective],
  selector: 'app-household-page',
  styleUrl: './household.page.css',
  templateUrl: './household.page.html',
})
export class HouseholdPageComponent {
  private readonly session = inject(AuthSessionStore);
  private readonly households = inject(HouseholdRepository);

  private readonly _email = signal('');
  private readonly _failed = signal(false);
  private readonly _feedback = signal<InviteFeedback | null>(null);
  private readonly _pending = signal(false);
  private readonly _submitted = signal(false);

  /** Only the owner may read invitations (rules); members just see the members. */
  private readonly pendingInvitations = toSignal(
    toObservable(
      computed(() => (this.session.isOwner() ? (this.session.household()?.id ?? null) : null))
    ).pipe(
      switchMap((householdId) =>
        householdId ? this.households.watchInvitations(householdId) : of<Invitation[]>([])
      ),
      catchError(() => of<Invitation[]>([]))
    ),
    { initialValue: [] }
  );

  protected readonly household = this.session.household;
  protected readonly isOwner = this.session.isOwner;
  protected readonly email = this._email.asReadonly();
  protected readonly pending = this._pending.asReadonly();
  protected readonly feedback = this._feedback.asReadonly();
  protected readonly failed = this._failed.asReadonly();
  protected readonly emailInvalid = computed(
    () => this._submitted() && !isValidEmail(normalizeEmail(this._email()))
  );
  protected readonly rows = computed((): MemberRow[] => {
    const household = this.household();
    const uid = this.session.profile()?.uid;
    if (!household) return [];

    const members = household.memberIds
      .filter((memberId) => household.members[memberId])
      .map((memberId) => ({
        id: memberId,
        isYou: memberId === uid,
        label: household.members[memberId].displayName,
        status: household.members[memberId].role,
      }));
    const invited = this.pendingInvitations().map((invitation) => ({
      id: `invitation:${invitation.email}`,
      isYou: false,
      label: invitation.email,
      status: 'pending' as const,
    }));
    return [...members, ...invited];
  });

  protected setEmail(event: Event): void {
    this._email.set(eventValue(event));
  }

  protected async invite(event: Event): Promise<void> {
    event.preventDefault();
    this._submitted.set(true);
    this._feedback.set(null);
    this._failed.set(false);
    const household = this.household();
    const profile = this.session.profile();
    if (this.emailInvalid() || this._pending() || !household || !profile) return;

    const email = normalizeEmail(this._email());
    this._pending.set(true);
    try {
      const result = await this.households.invite(household.id, household.name, email, profile.uid);
      // A repeated invitation already has its link; sending again would only spam the inbox.
      if (result === 'invited') await this.session.sendInvitationLink(email);
      this._feedback.set({ email, key: FEEDBACK_KEY[result] });
      this._email.set('');
      this._submitted.set(false);
    } catch {
      this._failed.set(true);
    } finally {
      this._pending.set(false);
    }
  }
}
