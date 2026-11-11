import { reloadOnNewDay } from './reload-on-new-day';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('reloadOnNewDay', () => {
  let clock: Date;
  let reload: ReturnType<typeof vi.fn<() => void>>;
  let visibility: DocumentVisibilityState;
  let stop: () => void;

  const now = (): Date => clock;
  const becomeVisible = (): void => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // 23:30 in Madrid (UTC+1 in winter).
    clock = new Date('2026-12-20T22:30:00Z');
    reload = vi.fn<() => void>();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    stop = reloadOnNewDay(document, now, reload, 60_000);
  });

  afterEach(() => {
    stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should reload when the app comes back on a later Madrid day', () => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    clock = new Date('2026-12-21T07:00:00Z');

    becomeVisible();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should not reload when the app comes back on the same Madrid day', () => {
    // 23:59 in Madrid, still the 20th although UTC is close to the 21st.
    clock = new Date('2026-12-20T22:59:00Z');

    becomeVisible();

    expect(reload).not.toHaveBeenCalled();
  });

  it('should reload at Madrid midnight while the app stays open', () => {
    clock = new Date('2026-12-20T23:00:30Z');
    vi.advanceTimersByTime(60_000);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should not reload while hidden, nor after being stopped', () => {
    clock = new Date('2026-12-21T07:00:00Z');
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reload).not.toHaveBeenCalled();
    stop();
    becomeVisible();
    vi.advanceTimersByTime(60_000);

    expect(reload).not.toHaveBeenCalled();
  });
});
