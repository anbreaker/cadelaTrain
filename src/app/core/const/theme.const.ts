export const THEMES = ['dark', 'light'] as const;

export type Theme = (typeof THEMES)[number];

/** Dark always wins by default, whatever the OS prefers: the user switches to light on purpose. */
export const DEFAULT_THEME: Theme = 'dark';

export const THEME_STORAGE_KEY = 'dela-theme';

/** Browser chrome colour per theme; must match `--color-bg` in `tokens.css` and the inline script in `index.html`. */
export const THEME_COLOR: Record<Theme, string> = {
  dark: '#121613',
  light: '#f3f5f0',
};
