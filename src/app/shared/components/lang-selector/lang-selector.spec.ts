import { ComponentFixture, TestBed } from '@angular/core/testing';

import { translocoTesting } from '@shared/testing/transloco-testing';

import { LangSelectorComponent } from './lang-selector';

describe('LangSelectorComponent', () => {
  let fixture: ComponentFixture<LangSelectorComponent>;

  const buttons = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [LangSelectorComponent, translocoTesting()] });
    fixture = TestBed.createComponent(LangSelectorComponent);
    fixture.componentRef.setInput('lang', 'es');
    await fixture.whenStable();
  });

  it('should label the group and show one flag + code pill per language', () => {
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');

    expect(group?.getAttribute('aria-label')).toBe('settings.language');
    expect(buttons().map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '🇺🇸 EN',
      '🇪🇸 ES',
      '🇵🇹 PT',
    ]);
  });

  it('should name each language in its own language', () => {
    expect(buttons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'English',
      'Español',
      'Português',
    ]);
  });

  it('should mark only the current language as pressed', () => {
    expect(buttons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('should emit the chosen language', () => {
    const chosen: string[] = [];
    fixture.componentInstance.langChange.subscribe((lang) => chosen.push(lang));

    buttons()[2].click();

    expect(chosen).toEqual(['pt']);
  });
});
