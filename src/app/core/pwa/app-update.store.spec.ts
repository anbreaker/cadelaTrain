import { Subject } from 'rxjs';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';

import { AppUpdateStore, DOCUMENT_RELOADER } from './app-update.store';
import { provideAppServiceWorker } from './service-worker';

interface SwUpdateStub {
  activateUpdate: ReturnType<typeof vi.fn>;
  isEnabled: boolean;
  unrecoverable: Subject<UnrecoverableStateEvent>;
  versionUpdates: Subject<VersionEvent>;
}

const versionReady: VersionEvent = {
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
  type: 'VERSION_READY',
};

describe('AppUpdateStore', () => {
  let swUpdate: SwUpdateStub;
  let reloadDocument: ReturnType<typeof vi.fn>;
  let calls: string[];

  const createStore = (isEnabled: boolean): AppUpdateStore => {
    swUpdate.isEnabled = isEnabled;
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: swUpdate },
        { provide: DOCUMENT_RELOADER, useValue: reloadDocument },
      ],
    });

    return TestBed.inject(AppUpdateStore);
  };

  beforeEach(() => {
    calls = [];
    reloadDocument = vi.fn(() => calls.push('reload'));
    swUpdate = {
      activateUpdate: vi.fn(async () => {
        calls.push('activate');
        return true;
      }),
      isEnabled: true,
      unrecoverable: new Subject<UnrecoverableStateEvent>(),
      versionUpdates: new Subject<VersionEvent>(),
    };
  });

  it('should not subscribe to the worker when the service worker is disabled', () => {
    const store = createStore(false);

    expect(swUpdate.unrecoverable.observed).toBe(false);
    expect(swUpdate.versionUpdates.observed).toBe(false);
    expect(store.updateReady()).toBe(false);
  });

  it('should reload the page when the worker reaches an unrecoverable state', () => {
    createStore(true);

    swUpdate.unrecoverable.next({ reason: 'evicted chunks', type: 'UNRECOVERABLE_STATE' });

    expect(reloadDocument).toHaveBeenCalledTimes(1);
  });

  it('should flag a ready update without reloading when a new version is ready', () => {
    const store = createStore(true);

    swUpdate.versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    expect(store.updateReady()).toBe(false);

    swUpdate.versionUpdates.next(versionReady);

    expect(store.updateReady()).toBe(true);
    expect(reloadDocument).not.toHaveBeenCalled();
  });

  it('should activate the update and then reload when the user applies it', async () => {
    const store = createStore(true);
    swUpdate.versionUpdates.next(versionReady);

    await store.applyUpdate();

    expect(calls).toEqual(['activate', 'reload']);
  });

  it('should still reload when activating the update fails', async () => {
    const store = createStore(true);
    swUpdate.activateUpdate.mockRejectedValueOnce(new Error('broken version'));

    await store.applyUpdate();

    expect(reloadDocument).toHaveBeenCalledTimes(1);
  });

  it('should start listening at bootstrap without anyone injecting the store', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppServiceWorker(),
        { provide: SwUpdate, useValue: swUpdate },
        { provide: DOCUMENT_RELOADER, useValue: reloadDocument },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    swUpdate.unrecoverable.next({ reason: 'evicted chunks', type: 'UNRECOVERABLE_STATE' });

    expect(reloadDocument).toHaveBeenCalledTimes(1);
  });
});
