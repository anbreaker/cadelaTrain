import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

export type MemberRowStatus = 'member' | 'owner' | 'pending';

export interface MemberRow {
  id: string;
  isYou: boolean;
  label: string;
  status: MemberRowStatus;
}

/** Members and pending invitations of a household. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-member-list',
  styleUrl: './member-list.css',
  templateUrl: './member-list.html',
})
export class MemberListComponent {
  readonly rows = input.required<readonly MemberRow[]>();
}
