import { prefersReducedMotion } from './view-transition';

/** On `<html>` only while a theme change animates, so page transitions keep their own animation. */
export const THEME_TRANSITION_CLASS = 'theme-transition';

export interface ScreenPoint {
  x: number;
  y: number;
}

type ViewTransitionDocument = Document & {
  startViewTransition: (update: () => void) => { finished: Promise<void>; ready: Promise<void> };
};

const supportsViewTransitions = (document: Document): document is ViewTransitionDocument =>
  'startViewTransition' in document && typeof document.startViewTransition === 'function';

/**
 * Applies `change` with a circular reveal that grows from `origin` (see `view-transitions.css`).
 * Without the View Transitions API, on a hidden page or with reduced motion, the theme simply switches.
 */
export function runThemeTransition(
  document: Document,
  origin: ScreenPoint,
  change: () => void
): void {
  const canAnimate = supportsViewTransitions(document) && document.visibilityState === 'visible';
  if (prefersReducedMotion() || !canAnimate) {
    change();
    return;
  }

  const html = document.documentElement;
  html.style.setProperty('--theme-x', `${origin.x}px`);
  html.style.setProperty('--theme-y', `${origin.y}px`);
  html.classList.add(THEME_TRANSITION_CLASS);
  const transition = document.startViewTransition(change);
  // An aborted transition (tab hidden mid-way, a newer one started) still applied the change.
  transition.ready.catch(() => undefined);
  transition.finished
    .finally(() => html.classList.remove(THEME_TRANSITION_CLASS))
    .catch(() => undefined);
}
