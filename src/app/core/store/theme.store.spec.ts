import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY } from '@core/const/theme.const';

import { ThemeStore } from './theme.store';

const themeColor = (): string | null =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;

describe('ThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    document.head.querySelector('meta[name="theme-color"]')?.remove();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#000000';
    document.head.appendChild(meta);
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start dark when nothing is stored, even if the system prefers light', () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);

    const store = TestBed.inject(ThemeStore);

    expect(store.theme()).toBe('dark');
    expect(store.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(themeColor()).toBe('#121613');
    expect(matchMedia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('should restore a stored light theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    const store = TestBed.inject(ThemeStore);

    expect(store.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(themeColor()).toBe('#f3f5f0');
  });

  it('should ignore an unknown stored value and stay dark', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(TestBed.inject(ThemeStore).theme()).toBe('dark');
  });

  it('should toggle between dark and light, persisting each choice on the device', () => {
    const store = TestBed.inject(ThemeStore);

    store.toggle();

    expect(store.theme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(themeColor()).toBe('#f3f5f0');

    store.toggle();

    expect(store.theme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(themeColor()).toBe('#121613');
  });

  it('should switch through the circular reveal when toggled from a point on screen', () => {
    const start = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve(), ready: Promise.resolve() };
    });
    Object.assign(document, { startViewTransition: start });
    const store = TestBed.inject(ThemeStore);

    store.toggle({ x: 30, y: 40 });

    expect(start).toHaveBeenCalledOnce();
    expect(store.theme()).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--theme-x')).toBe('30px');
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('should still apply the theme when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = TestBed.inject(ThemeStore);

    store.setTheme('light');

    expect(store.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
