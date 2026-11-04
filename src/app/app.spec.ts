import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { AppComponent } from './app';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        TranslocoTestingModule.forRoot({
          langs: { es: { app: { name: 'Dela' } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the app name in the header and the router outlet in main', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-header__title')?.textContent?.trim()).toBe('Dela');
    expect(compiled.querySelector('main router-outlet')).not.toBeNull();
  });
});
