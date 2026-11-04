import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { AppUpdateStore } from '@core/pwa/app-update.store';

import { AppComponent } from './app';

describe('AppComponent', () => {
  let updateReady: WritableSignal<boolean>;
  let applyUpdate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateReady = signal(false);
    applyUpdate = vi.fn(async () => undefined);

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              app: { name: 'Dela' },
              pwa: { reload: 'Recargar', updateReady: 'Hay una versión nueva' },
            },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: AppUpdateStore,
          useValue: { applyUpdate, updateReady: updateReady.asReadonly() },
        },
      ],
    }).compileComponents();
  });

  it('should render the app name in the header and the router outlet in main', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-header__title')?.textContent?.trim()).toBe('Dela');
    expect(compiled.querySelector('main router-outlet')).not.toBeNull();
  });

  it('should not show the update banner while no new version is ready', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.update-banner')).toBeNull();
  });

  it('should show the update banner when a new version is ready and apply it on reload', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    updateReady.set(true);
    await fixture.whenStable();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('.update-banner');
    const button = banner?.querySelector<HTMLButtonElement>('.update-banner__button');

    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.querySelector('.update-banner__text')?.textContent?.trim()).toBe(
      'Hay una versión nueva'
    );
    expect(button?.textContent?.trim()).toBe('Recargar');
    expect(button?.type).toBe('button');

    button?.click();

    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });
});
