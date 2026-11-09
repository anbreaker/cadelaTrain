import { inject, InjectionToken } from '@angular/core';
import { withNavigationErrorHandler } from '@angular/router';

const LAST_RELOAD_KEY = 'framed-chunk-reload';
/** A second failure on the same page this soon after reloading is a real outage, not an old build. */
const RETRY_WINDOW_MS = 10000;

/** Messages browsers and Vite give when a lazy part of the app cannot be downloaded. */
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** Loads a page from scratch; replaced in tests. */
export const PAGE_RELOADER = new InjectionToken<(url: string) => void>('PAGE_RELOADER', {
  factory: (): ((url: string) => void) => (url) => window.location.assign(url),
});

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);
}

/** True when this is the first failure on `url` in a while; remembers it for the next one. */
function firstTryFor(url: string, now: number): boolean {
  try {
    const [lastUrl, lastAt] = (sessionStorage.getItem(LAST_RELOAD_KEY) ?? '').split('|');
    if (lastUrl === url && now - Number(lastAt) < RETRY_WINDOW_MS) return false;

    sessionStorage.setItem(LAST_RELOAD_KEY, `${url}|${now}`);
    return true;
  } catch {
    return false; // without storage it cannot tell a retry from a loop, so it does not reload
  }
}

/**
 * After a deploy, a tab opened before it asks for files of the old build that no longer exist, and the
 * navigation fails without a word. This loads the page it was going to from scratch, once, so the
 * browser gets the new build.
 */
export function withChunkLoadRecovery(): ReturnType<typeof withNavigationErrorHandler> {
  return withNavigationErrorHandler((navigationError) => {
    if (!isChunkLoadError(navigationError.error)) return;
    if (!firstTryFor(navigationError.url, Date.now())) return;

    inject(PAGE_RELOADER)(navigationError.url);
  });
}
