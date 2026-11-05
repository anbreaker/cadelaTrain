import { filter } from 'rxjs';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionEvent, VersionReadyEvent } from '@angular/service-worker';

/** Reloads the current document; replaced in tests. */
export const DOCUMENT_RELOADER = new InjectionToken<() => void>('DOCUMENT_RELOADER', {
  factory: (): (() => void) => () => window.location.reload(),
});

function isVersionReady(versionEvent: VersionEvent): versionEvent is VersionReadyEvent {
  return versionEvent.type === 'VERSION_READY';
}

/**
 * Keeps installed clients on the deployed build. A ready update only raises `updateReady` instead of
 * reloading, because a trainer may be in the middle of logging a session.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateStore {
  private readonly swUpdate = inject(SwUpdate);
  private readonly reloadDocument = inject(DOCUMENT_RELOADER);

  private readonly _updateReady = signal(false);

  readonly updateReady = this._updateReady.asReadonly();

  constructor() {
    if (!this.swUpdate.isEnabled) return;

    // The cached version references files the browser evicted; only a fresh load can recover.
    this.swUpdate.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.reloadDocument());

    this.swUpdate.versionUpdates
      .pipe(filter(isVersionReady), takeUntilDestroyed())
      .subscribe(() => this._updateReady.set(true));
  }

  async applyUpdate(): Promise<void> {
    // If activation fails, reloading still gets the new build from the network.
    await this.swUpdate.activateUpdate().catch(() => false);
    this.reloadDocument();
  }
}
