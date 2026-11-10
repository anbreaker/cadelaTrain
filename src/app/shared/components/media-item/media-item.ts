import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoDirective } from '@jsverse/transloco';

import { cloudinaryImage } from '@domain/cloudinary-url';
import { isYoutubeId, Media } from '@domain/media';

import { MediaItemView } from '../media-list/media-list-view';

/**
 * One photo or video of a day (AC7.5). A photo loads from Cloudinary in responsive sizes; a video is
 * a facade, its thumbnail, and the `youtube-nocookie.com` player loads only after a tap. The author
 * gets a delete button (AC7.6).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  selector: 'app-media-item',
  styleUrl: './media-item.css',
  templateUrl: './media-item.html',
})
export class MediaItemComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly busy = input(false);
  /** Cloudinary cloud name; empty means photos cannot be shown. */
  readonly cloudName = input('');
  readonly item = input.required<MediaItemView>();

  readonly removed = output<Media>();

  private readonly playing = signal(false);

  protected readonly media = computed(() => this.item().media);
  protected readonly isPhoto = computed(() => this.media().kind === 'photo');
  protected readonly photo = computed(() => {
    const { height, publicId, width } = this.media();
    const cloudName = this.cloudName();
    return cloudName && publicId && width && height
      ? { ...cloudinaryImage(cloudName, publicId, width), height, width }
      : null;
  });
  /** Only a valid 11-character id ever reaches a URL. */
  private readonly videoId = computed(() => {
    const id = this.media().youtubeId;
    return id && isYoutubeId(id) ? id : null;
  });
  protected readonly thumbnail = computed(() => {
    const id = this.videoId();
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  });
  protected readonly player = computed((): null | SafeResourceUrl => {
    const id = this.videoId();
    return id && this.playing()
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
        )
      : null;
  });
  protected readonly skillNameKey = computed(() => {
    const skillKey = this.media().skillKey;
    return skillKey ? `catalog.skills.${skillKey}.name` : null;
  });

  protected play(): void {
    this.playing.set(true);
  }

  protected remove(): void {
    this.removed.emit(this.media());
  }
}
