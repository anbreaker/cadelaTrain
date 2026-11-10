import { TestBed } from '@angular/core/testing';

import { AuthSessionStore } from '@core/session/auth-session.store';
import { PRINCIPLES, SKILLS } from '@domain/catalog';
import { Dog } from '@domain/dog';
import { createFakeSession, FakeSession } from '@shared/testing/fake-session';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { RulesPageComponent } from './rules.page';

const dela: Dog = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  id: 'd1',
  name: 'Dela',
  notes: '',
  planWeek: 1,
  sleepsOutdoors: true,
};

describe('RulesPageComponent', () => {
  let session: FakeSession;

  const render = async (): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      imports: [RulesPageComponent, translocoTesting()],
      providers: [{ provide: AuthSessionStore, useValue: session }],
    });
    const fixture = TestBed.createComponent(RulesPageComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = createFakeSession();
    session.set.dog.set(dela);
  });

  it('should list the cue word of every skill, plus drop, praise, release and no', async () => {
    const element = await render();
    const rows = Array.from(element.querySelectorAll<HTMLElement>('.rules__cue'));

    expect(rows).toHaveLength(SKILLS.length + 4);
    expect(rows.at(-4)?.querySelector('.rules__cue-word')?.textContent).toContain(
      'catalog.cues.drop'
    );
    expect(rows[1].querySelector('.rules__cue-skill')?.textContent).toContain(
      'catalog.skills.search.name'
    );
    expect(rows[1].querySelector('.rules__cue-word')?.textContent).toContain(
      'catalog.skills.search.cue'
    );
    expect(rows.at(-1)?.querySelector('.rules__cue-word')?.textContent).toContain(
      'catalog.cues.no'
    );
    expect(rows.at(-2)?.querySelector('.rules__cue-skill')?.textContent).toContain(
      'rules.cues.release'
    );
    expect(rows.at(-2)?.querySelector('.rules__cue-word')?.textContent).toContain(
      'catalog.cues.release'
    );
  });

  it('should list every training principle', async () => {
    const element = await render();
    const principles = element.querySelectorAll('.rules__principle');

    expect(principles).toHaveLength(PRINCIPLES.length);
    expect(principles[0].textContent).toContain(`catalog.principles.${PRINCIPLES[0].key}`);
  });
});
