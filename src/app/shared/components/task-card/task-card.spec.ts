import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { translocoTesting } from '@shared/testing/transloco-testing';

import { TaskCardComponent, TaskCardView } from './task-card';

const card = (overrides: Partial<TaskCardView> = {}): TaskCardView => ({
  done: null,
  durationMin: 5,
  id: 't1',
  instructions: 'Say her name and reward.',
  kind: 'training',
  title: 'Training: name',
  ...overrides,
});

@Component({
  imports: [TaskCardComponent],
  template: '<app-task-card [card]="card()" />',
})
class HostComponent {
  readonly card = signal(card());
}

describe('TaskCardComponent', () => {
  const render = async (view: TaskCardView): Promise<HTMLElement> => {
    TestBed.configureTestingModule({ imports: [HostComponent, translocoTesting()] });
    const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
    fixture.componentInstance.card.set(view);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('should show title, instructions, minutes and the kind label with its icon (AC2.2)', async () => {
    const element = await render(card());

    expect(element.querySelector('.task-card__title')?.textContent).toContain('Training: name');
    expect(element.querySelector('.task-card__instructions')?.textContent).toContain(
      'Say her name'
    );
    expect(element.querySelector('.task-card__duration')?.textContent).toContain('today.minutes');
    expect(element.querySelector('.task-card__kind')?.textContent).toContain('taskKinds.training');
    expect(element.querySelector('.task-card__icon')?.textContent?.trim()).not.toBe('');
  });

  it('should show a dash when the task has no duration (AC2.2)', async () => {
    const element = await render(card({ durationMin: null }));
    const duration = element.querySelector('.task-card__duration');

    expect(duration?.textContent?.trim()).toBe('—');
    expect(duration?.getAttribute('aria-label')).toBe('today.noDuration');
  });

  it('should say who did the task and when (AC2.3)', async () => {
    const done = await render(card({ done: { at: '09:15', by: 'Jéssica' } }));
    const anonymous = await (async () => {
      TestBed.resetTestingModule();
      return render(card({ done: { at: '09:15', by: null } }));
    })();

    expect(done.querySelector('.task-card')?.classList).toContain('task-card--done');
    expect(done.querySelector('.task-card__done')?.textContent).toContain('today.doneBy');
    expect(anonymous.querySelector('.task-card__done')?.textContent).toContain('today.doneAt');
  });

  it('should not show a done line for pending tasks', async () => {
    const element = await render(card());

    expect(element.querySelector('.task-card__done')).toBeNull();
  });
});
