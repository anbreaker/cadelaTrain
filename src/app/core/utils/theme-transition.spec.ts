import { runThemeTransition, THEME_TRANSITION_CLASS } from './theme-transition';

type StartViewTransition = (update: () => void) => {
  finished: Promise<void>;
  ready: Promise<void>;
};

const stubReducedMotion = (matches: boolean): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches }))
  );
};

describe('runThemeTransition', () => {
  let change: ReturnType<typeof vi.fn<() => void>>;
  const html = document.documentElement;

  const withViewTransitions = (
    start: StartViewTransition,
    visibilityState: DocumentVisibilityState = 'visible'
  ): Document =>
    ({ documentElement: html, startViewTransition: start, visibilityState }) as unknown as Document;

  beforeEach(() => {
    change = vi.fn<() => void>();
    html.classList.remove(THEME_TRANSITION_CLASS);
    html.style.removeProperty('--theme-x');
    html.style.removeProperty('--theme-y');
    stubReducedMotion(false);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should change at once where View Transitions are not supported', () => {
    runThemeTransition(document, { x: 10, y: 20 }, change);

    expect(change).toHaveBeenCalledOnce();
    expect(html.classList.contains(THEME_TRANSITION_CLASS)).toBe(false);
  });

  it('should change at once without animation when the user asks for reduced motion', () => {
    stubReducedMotion(true);
    const start = vi.fn<StartViewTransition>();

    runThemeTransition(withViewTransitions(start), { x: 10, y: 20 }, change);

    expect(start).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledOnce();
  });

  it('should reveal the new theme in a circle from the click point', async () => {
    let finish: () => void = () => undefined;
    const start = vi.fn<StartViewTransition>((update) => {
      update();
      return {
        finished: new Promise<void>((resolve) => (finish = resolve)),
        ready: Promise.resolve(),
      };
    });

    runThemeTransition(withViewTransitions(start), { x: 120, y: 48 }, change);

    expect(start).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
    expect(html.style.getPropertyValue('--theme-x')).toBe('120px');
    expect(html.style.getPropertyValue('--theme-y')).toBe('48px');
    expect(html.classList.contains(THEME_TRANSITION_CLASS)).toBe(true);

    finish();
    await Promise.resolve();
    await Promise.resolve();

    expect(html.classList.contains(THEME_TRANSITION_CLASS)).toBe(false);
  });

  it('should change at once without a transition while the page is hidden', () => {
    const start = vi.fn<StartViewTransition>();

    runThemeTransition(withViewTransitions(start, 'hidden'), { x: 10, y: 20 }, change);

    expect(start).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledOnce();
  });

  it('should swallow an aborted transition instead of surfacing an unhandled error', async () => {
    const aborted = (): Promise<void> => Promise.reject(new DOMException('aborted', 'AbortError'));
    const start = vi.fn<StartViewTransition>((update) => {
      update();
      return { finished: aborted(), ready: aborted() };
    });

    runThemeTransition(withViewTransitions(start), { x: 1, y: 2 }, change);
    await new Promise((resolve) => setTimeout(resolve));

    expect(change).toHaveBeenCalledOnce();
    expect(html.classList.contains(THEME_TRANSITION_CLASS)).toBe(false);
  });
});
