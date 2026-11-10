import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Media } from '@domain/media';

import { MediaItemComponent } from '../media-item/media-item';
import { MediaDayView } from './media-list-view';

/** Photos and videos per day, newest day first (AC7.5); the author deletes their own (AC7.6). */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MediaItemComponent],
  selector: 'app-media-list',
  styleUrl: './media-list.css',
  templateUrl: './media-list.html',
})
export class MediaListComponent {
  /** Id of the item being deleted, whose button is disabled. */
  readonly busyId = input<null | string>(null);
  readonly cloudName = input('');
  readonly days = input.required<MediaDayView[]>();
  /** A single day (Today) needs no date headings. */
  readonly showDates = input(true);

  readonly removed = output<Media>();
}
