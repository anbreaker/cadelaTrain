import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScreenPoint } from '@core/utils/theme-transition';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { ThemeToggleComponent } from './theme-toggle';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let origins: ScreenPoint[];

  const button = (): HTMLButtonElement => {
    const element = (fixture.nativeElement as HTMLElement).querySelector('button');
    if (!element) throw new Error('button missing');
    return element;
  };

  const render = async (isDark: boolean): Promise<void> => {
    TestBed.configureTestingModule({ imports: [ThemeToggleComponent, translocoTesting()] });
    fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.componentRef.setInput('isDark', isDark);
    origins = [];
    fixture.componentInstance.toggle.subscribe((origin) => origins.push(origin));
    await fixture.whenStable();
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('should offer the light mode while dark and show the moon', async () => {
    await render(true);

    expect(button().getAttribute('aria-label')).toBe('settings.switchToLight');
    expect(
      button().querySelector('.theme-toggle__icon--current .theme-toggle__moon')
    ).not.toBeNull();
    expect(button().querySelector('.theme-toggle__icon--target .theme-toggle__sun')).not.toBeNull();
  });

  it('should offer the dark mode while light and show the sun', async () => {
    await render(false);

    expect(button().getAttribute('aria-label')).toBe('settings.switchToDark');
    expect(
      button().querySelector('.theme-toggle__icon--current .theme-toggle__sun')
    ).not.toBeNull();
  });

  it('should emit the click point as the origin of the reveal', async () => {
    await render(true);

    button().dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 30, detail: 1 }));

    expect(origins).toEqual([{ x: 200, y: 30 }]);
  });

  it('should reveal from the centre of the button when activated from the keyboard', async () => {
    await render(true);
    vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({
      height: 44,
      left: 100,
      top: 10,
      width: 44,
    } as DOMRect);

    button().dispatchEvent(new MouseEvent('click', { detail: 0 }));

    expect(origins).toEqual([{ x: 122, y: 32 }]);
  });
});
