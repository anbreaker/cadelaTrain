import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function deepestChild(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = snapshot;
  while (current.firstChild) current = current.firstChild;

  return current;
}

/** True when only query parameters or the fragment changed, such as the email-link callback. */
export function isSamePageNavigation(
  from: ActivatedRouteSnapshot,
  to: ActivatedRouteSnapshot
): boolean {
  const origin = deepestChild(from);
  const destination = deepestChild(to);

  return (
    origin.routeConfig === destination.routeConfig &&
    JSON.stringify(origin.params) === JSON.stringify(destination.params)
  );
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches;

/**
 * Page transitions are for moving between pages; in-page changes stay instant. With reduced motion
 * the transition is skipped outright: muting the CSS animation alone would still freeze a snapshot.
 */
export const skipSamePageTransitions = ({ from, to, transition }: ViewTransitionInfo): void => {
  if (prefersReducedMotion() || isSamePageNavigation(from, to)) transition.skipTransition();
};

type UpdateCallback = () => Promise<void> | void;

/** What `startViewTransition` returns when nothing animates: the update runs and everything resolves. */
function instantTransition(update: UpdateCallback): ViewTransition {
  const done = Promise.resolve().then(update);
  return {
    finished: done,
    ready: Promise.resolve(),
    skipTransition: (): void => undefined,
    updateCallbackDone: done,
  } as ViewTransition;
}

/**
 * A hidden page (background tab, locked phone) cannot start a View Transition: the browser aborts it
 * with `InvalidStateError`, which the router then logs. While hidden, the change is applied without one.
 */
export function startTransitionsOnlyWhenVisible(document: Document): void {
  if (typeof document.startViewTransition !== 'function') return;

  const start = document.startViewTransition.bind(document);
  document.startViewTransition = ((update?: UpdateCallback): ViewTransition =>
    document.visibilityState === 'visible'
      ? start(update)
      : instantTransition(update ?? ((): void => undefined))) as Document['startViewTransition'];
}
