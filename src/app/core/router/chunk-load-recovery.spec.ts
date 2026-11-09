import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { isChunkLoadError, PAGE_RELOADER, withChunkLoadRecovery } from './chunk-load-recovery';

@Component({ template: '' })
class PageComponent {}

const CHROME = new TypeError('Failed to fetch dynamically imported module: /assets/admin-AbC.js');

describe('isChunkLoadError', () => {
  it.each([
    CHROME,
    new TypeError('error loading dynamically imported module: /assets/a.js'),
    new TypeError('Importing a module script failed.'),
    new Error('Unable to preload CSS for /assets/a.css'),
  ])('should recognise a part of the app that could not be downloaded: %s', (error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([new Error('permission-denied'), 'Failed to fetch dynamically', null])(
    'should leave any other failure alone: %s',
    (error) => {
      expect(isChunkLoadError(error)).toBe(false);
    }
  );
});

describe('withChunkLoadRecovery', () => {
  const reload = vi.fn();
  let failure: unknown;

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockReset();
    failure = CHROME;

    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { component: PageComponent, path: '' },
            { loadComponent: () => Promise.reject(failure), path: 'admin/settings' },
          ],
          withChunkLoadRecovery()
        ),
        { provide: PAGE_RELOADER, useValue: reload },
      ],
    });
  });

  const navigate = (): Promise<boolean> =>
    TestBed.inject(Router)
      .navigateByUrl('/admin/settings')
      .catch(() => false);

  it('should load the page it was going to from scratch, so the new build is downloaded', async () => {
    await navigate();

    expect(reload).toHaveBeenCalledWith('/admin/settings');
  });

  it('should try only once in a row, so a real outage does not reload forever', async () => {
    await navigate();
    await navigate();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should leave other navigation failures to the router', async () => {
    failure = new Error('permission-denied');

    await navigate();

    expect(reload).not.toHaveBeenCalled();
  });

  it('should not reload when it cannot remember that it already tried', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await navigate();

    expect(reload).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
