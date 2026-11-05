import { ActivatedRouteSnapshot, Route, ViewTransitionInfo } from '@angular/router';

import {
  isSamePageNavigation,
  prefersReducedMotion,
  skipSamePageTransitions,
  startTransitionsOnlyWhenVisible,
} from './view-transition';

const today: Route = { path: 'today' };
const household: Route = { path: 'household' };
const dog: Route = { path: 'dog/:dogId' };

const snapshot = (
  routeConfig: Route,
  params: Record<string, string> = {}
): ActivatedRouteSnapshot =>
  ({
    firstChild: null,
    params,
    routeConfig,
  }) as unknown as ActivatedRouteSnapshot;

const withParent = (child: ActivatedRouteSnapshot): ActivatedRouteSnapshot =>
  ({ firstChild: child, params: {}, routeConfig: null }) as unknown as ActivatedRouteSnapshot;

const stubReducedMotion = (matches: boolean): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: matches && query === '(prefers-reduced-motion: reduce)' }))
  );
};

describe('isSamePageNavigation', () => {
  it('should treat a change that keeps the same route and params as the same page', () => {
    expect(isSamePageNavigation(withParent(snapshot(today)), withParent(snapshot(today)))).toBe(
      true
    );
  });

  it('should treat another route as a different page', () => {
    expect(isSamePageNavigation(withParent(snapshot(today)), withParent(snapshot(household)))).toBe(
      false
    );
  });

  it('should treat the same route with other params as a different page', () => {
    expect(
      isSamePageNavigation(
        withParent(snapshot(dog, { dogId: '1' })),
        withParent(snapshot(dog, { dogId: '2' }))
      )
    ).toBe(false);
  });
});

describe('prefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should follow the reduced motion media query', () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);

    stubReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('should assume motion is fine where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('skipSamePageTransitions', () => {
  const transition = (): { skipTransition: ReturnType<typeof vi.fn> } => ({
    skipTransition: vi.fn(),
  });

  const run = (from: Route, to: Route): ReturnType<typeof transition> => {
    const view = transition();
    skipSamePageTransitions({
      from: snapshot(from),
      to: snapshot(to),
      transition: view,
    } as unknown as ViewTransitionInfo);
    return view;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('should skip the transition for in-page navigations', () => {
    stubReducedMotion(false);

    expect(run(today, today).skipTransition).toHaveBeenCalledOnce();
  });

  it('should keep the transition when the page changes', () => {
    stubReducedMotion(false);

    expect(run(today, household).skipTransition).not.toHaveBeenCalled();
  });

  it('should skip every transition when the user asks for reduced motion', () => {
    stubReducedMotion(true);

    expect(run(today, household).skipTransition).toHaveBeenCalledOnce();
  });
});

describe('startTransitionsOnlyWhenVisible', () => {
  type Start = (update: () => Promise<void> | void) => ViewTransition;

  const fakeDocument = (visibilityState: DocumentVisibilityState, start?: Start): Document =>
    ({ startViewTransition: start, visibilityState }) as unknown as Document;

  it('should start a real transition while the page is visible', () => {
    const transition = {} as ViewTransition;
    const start = vi.fn<Start>(() => transition);
    const document = fakeDocument('visible', start);
    startTransitionsOnlyWhenVisible(document);

    expect(document.startViewTransition(() => undefined)).toBe(transition);
    expect(start).toHaveBeenCalledOnce();
  });

  it('should only apply the update, without a transition, while the page is hidden', async () => {
    const start = vi.fn<Start>();
    const update = vi.fn();
    const document = fakeDocument('hidden', start);
    startTransitionsOnlyWhenVisible(document);

    const transition = document.startViewTransition(update);
    await transition.finished;
    await transition.ready;
    await transition.updateCallbackDone;

    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
    expect(() => transition.skipTransition()).not.toThrow();
  });

  it('should leave browsers without View Transitions untouched', () => {
    const document = fakeDocument('hidden');

    startTransitionsOnlyWhenVisible(document);

    expect(document.startViewTransition).toBeUndefined();
  });
});
