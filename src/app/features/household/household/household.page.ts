import { catchError, firstValueFrom, of, switchMap } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { NOW } from '@core/time/now';
import { DogRepository } from '@data/dog.repository';
import { Invitation, InviteResult } from '@data/household.converter';
import { HouseholdRepository } from '@data/household.repository';
import { TaskLogRepository } from '@data/task-log.repository';
import { madridToday } from '@domain/dates';
import { dogDraft, validateDogDraft } from '@domain/dog';
import { isValidEmail, normalizeEmail } from '@domain/email';
import { notesExport, notesExportFileName } from '@domain/notes-export';
import { errorsByField } from '@features/dog/dog-error-keys';
import { MemberListComponent, MemberRow } from '@shared/components/member-list/member-list';
import { downloadText } from '@shared/utils/download-text';
import { eventValue } from '@shared/utils/event-value';

const FEEDBACK_KEY: Record<InviteResult, string> = {
  alreadyInvited: 'household.alreadyInvited',
  invited: 'household.invited',
};

type ArrivalState = 'failed' | 'idle' | 'saved' | 'saving';

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
  private readonly taskLogs = inject(TaskLogRepository);
  private readonly document = inject(DOCUMENT);
  private readonly now = inject(NOW);

  private readonly dogs = inject(DogRepository);

  /** `null` until the member edits it: the field then follows the stored date. */
  private readonly _arrivalDate = signal<null | string>(null);
  private readonly _arrivalState = signal<ArrivalState>('idle');
  private readonly _arrivalSubmitted = signal(false);
  private readonly _email = signal('');
  private readonly _exportFailed = signal(false);
  private readonly _exporting = signal(false);
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

  protected readonly arrivalDate = computed(
    () => this._arrivalDate() ?? this.session.dog()?.arrivalDate ?? ''
  );
  private readonly arrivalDraft = computed(() => {
    const dog = this.session.dog();
    return dog ? { ...dogDraft(dog), arrivalDate: this.arrivalDate() } : null;
  });
  protected readonly arrivalError = computed(() => {
    const draft = this.arrivalDraft();
    if (!this._arrivalSubmitted() || !draft) return null;
    return errorsByField(validateDogDraft(draft, madridToday(this.now()))).arrivalDate ?? null;
  });
  protected readonly arrivalState = this._arrivalState.asReadonly();
  protected readonly household = this.session.household;
  protected readonly dog = this.session.dog;
  protected readonly exporting = this._exporting.asReadonly();
  protected readonly exportFailed = this._exportFailed.asReadonly();
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

  protected setArrivalDate(event: Event): void {
    this._arrivalDate.set(eventValue(event));
    this._arrivalState.set('idle');
  }

  /** Any member may move the arrival date; the rest of the dog's details are saved unchanged. */
  protected async saveArrival(event: Event): Promise<void> {
    event.preventDefault();
    this._arrivalSubmitted.set(true);
    const household = this.household();
    const dog = this.dog();
    const draft = this.arrivalDraft();
    if (!household || !dog || !draft || this.arrivalError() || this._arrivalState() === 'saving')
      return;

    this._arrivalState.set('saving');
    try {
      await this.dogs.update(household.id, dog.id, draft, madridToday(this.now()));
      this._arrivalState.set('saved');
    } catch {
      this._arrivalState.set('failed');
    }
  }

  /** Downloads every log and note of the dog as one Markdown file, read with the member's own access. */
  protected async exportNotes(): Promise<void> {
    const household = this.session.household();
    const dog = this.dog();
    if (!household || !dog || this._exporting()) return;
    this._exporting.set(true);
    this._exportFailed.set(false);
    try {
      const [logs, socialization] = await Promise.all([
        firstValueFrom(this.taskLogs.watchAll(household.id, dog.id)),
        firstValueFrom(this.taskLogs.watchSocialization(household.id, dog.id)),
      ]);
      const now = this.now();
      const text = notesExport({
        dogName: dog.name,
        logs,
        members: household.members,
        now,
        socialization,
      });
      downloadText(this.document, notesExportFileName(dog.name, now), text);
    } catch (error) {
      console.warn('Household: could not export the notes', error);
      this._exportFailed.set(true);
    } finally {
      this._exporting.set(false);
    }
  }

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
