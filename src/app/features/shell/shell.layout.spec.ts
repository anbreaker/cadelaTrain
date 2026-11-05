import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ShellLayoutComponent } from './shell.layout';

describe('ShellLayoutComponent', () => {
  it('should render the signed-in screens inside the main landmark, with no navigation of its own', async () => {
    TestBed.configureTestingModule({
      imports: [ShellLayoutComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ShellLayoutComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('main#main-content router-outlet')).not.toBeNull();
    expect(element.querySelector('nav')).toBeNull();
  });
});
