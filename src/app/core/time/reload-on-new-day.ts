import { madridToday } from '@domain/dates';

/**
 * Screens read "today" once, when they open. A phone may keep the app open for days, so when it
 * comes back to the foreground (or stays open past midnight) on a later Madrid day, the document is
 * reloaded and every screen starts on the new day. Returns a function that stops watching.
 */
export const reloadOnNewDay = (
  document: Document,
  now: () => Date,
  reload: () => void,
  everyMs = 60_000
): (() => void) => {
  const openedOn = madridToday(now());
  const check = (): void => {
    if (document.visibilityState === 'visible' && madridToday(now()) !== openedOn) reload();
  };
  document.addEventListener('visibilitychange', check);
  const timer = setInterval(check, everyMs);
  return () => {
    document.removeEventListener('visibilitychange', check);
    clearInterval(timer);
  };
};
