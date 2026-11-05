import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { translocoTesting } from '@shared/testing/transloco-testing';

import { NavItem, SiteHeaderComponent } from './site-header';

const NAV: readonly NavItem[] = [
  { labelKey: 'nav.today', path: '/today' },
  { labelKey: 'nav.household', path: '/household' },
];

describe('SiteHeaderComponent', () => {
  let fixture: ComponentFixture<SiteHeaderComponent>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const menuButton = (): HTMLButtonElement =>
    root().querySelector('.site-header__menu-button') as HTMLButtonElement;
  const panel = (): HTMLElement => root().querySelector('#site-menu') as HTMLElement;
  const isOpen = (): boolean => panel().classList.contains('site-header__panel--open');

  const render = async (
    inputs: { navItems?: readonly NavItem[]; signedIn?: boolean } = {}
  ): Promise<void> => {
    TestBed.configureTestingModule({
      imports: [SiteHeaderComponent, translocoTesting()],
      providers: [
        provideRouter([
          { children: [], path: 'today' },
          { children: [], path: 'household' },
        ]),
      ],
    });
    fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.componentRef.setInput('isDark', true);
    fixture.componentRef.setInput('lang', 'es');
    fixture.componentRef.setInput('navItems', inputs.navItems ?? NAV);
    fixture.componentRef.setInput('signedIn', inputs.signedIn ?? true);
    await fixture.whenStable();
  };

  const toggleMenu = async (): Promise<void> => {
    menuButton().click();
    await fixture.whenStable();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    document.body.classList.remove('menu-open');
  });

  it('should put the language pills, the theme button and the navigation inside the menu panel', async () => {
    await render();

    expect(panel().querySelector('app-lang-selector')).not.toBeNull();
    expect(panel().querySelector('app-theme-toggle')).not.toBeNull();
    expect(
      Array.from(panel().querySelectorAll('.site-header__link')).map((link) =>
        link.getAttribute('href')
      )
    ).toEqual(['/today', '/household']);
  });

  it('should show no navigation or sign out to a visitor', async () => {
    await render({ navItems: [], signedIn: false });

    expect(panel().querySelector('nav')).toBeNull();
    expect(panel().querySelector('.site-header__sign-out')).toBeNull();
  });

  it('should open the panel from the menu button and say so to assistive technology', async () => {
    await render();

    expect(menuButton().getAttribute('aria-controls')).toBe('site-menu');
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(menuButton().getAttribute('aria-label')).toBe('nav.openMenu');
    expect(isOpen()).toBe(false);

    await toggleMenu();

    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    expect(menuButton().getAttribute('aria-label')).toBe('nav.closeMenu');
    expect(isOpen()).toBe(true);
    expect(document.body.classList.contains('menu-open')).toBe(true);
  });

  it('should close with Escape and give the focus back to the menu button', async () => {
    await render();
    await toggleMenu();

    root().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    await fixture.whenStable();

    expect(isOpen()).toBe(false);
    expect(document.body.classList.contains('menu-open')).toBe(false);
    expect(document.activeElement).toBe(menuButton());
  });

  it('should close when a navigation link is followed', async () => {
    await render();
    await toggleMenu();

    panel().querySelector<HTMLAnchorElement>('.site-header__link')?.click();
    await fixture.whenStable();

    expect(isOpen()).toBe(false);
  });

  it('should emit sign out and close the menu', async () => {
    await render();
    const signOuts: void[] = [];
    fixture.componentInstance.signOut.subscribe(() => signOuts.push(undefined));
    await toggleMenu();

    panel().querySelector<HTMLButtonElement>('.site-header__sign-out')?.click();
    await fixture.whenStable();

    expect(signOuts).toHaveLength(1);
    expect(isOpen()).toBe(false);
  });

  it('should release the scroll lock when it is destroyed while open', async () => {
    await render();
    await toggleMenu();

    fixture.destroy();

    expect(document.body.classList.contains('menu-open')).toBe(false);
  });
});
