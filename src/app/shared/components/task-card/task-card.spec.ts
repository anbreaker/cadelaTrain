import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { translocoTesting } from '@shared/testing/transloco-testing';

import { TaskCardComponent, TaskCardView } from './task-card';

const card = (overrides: Partial<TaskCardView> = {}): TaskCardView => ({
  canEdit: false,
  count: 0,
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
  template:
    '<app-task-card [card]="card()" [readOnly]="readOnly()" (edited)="edits = edits + 1" (marked)="marks = marks + 1" />',
})
class HostComponent {
  readonly card = signal(card());
  readonly readOnly = signal(false);
  edits = 0;
  marks = 0;
}

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const render = async (view: TaskCardView): Promise<HTMLElement> => {
    TestBed.configureTestingModule({ imports: [HostComponent, translocoTesting()] });
    fixture = TestBed.createComponent(HostComponent);
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

  it('should offer Done and emit it (AC3.1)', async () => {
    const element = await render(card());

    element.querySelector<HTMLButtonElement>('.task-card__mark')?.click();

    expect(fixture.componentInstance.marks).toBe(1);
    expect(element.querySelector('.task-card__edit')).toBeNull();
  });

  it('should hide the actions when read-only', async () => {
    TestBed.configureTestingModule({ imports: [HostComponent, translocoTesting()] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.card.set(card({ canEdit: true }));
    fixture.componentInstance.readOnly.set(true);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.task-card__mark')).toBeNull();
    expect(element.querySelector('.task-card__edit')).toBeNull();
    expect(element.querySelector('.task-card__title')?.textContent).toContain('Training: name');
  });

  it('should offer Edit only when my latest log can still be edited (AC3.6)', async () => {
    const element = await render(
      card({ canEdit: true, count: 1, done: { at: '09:15', by: 'Jéssica' } })
    );

    element.querySelector<HTMLButtonElement>('.task-card__edit')?.click();

    expect(fixture.componentInstance.edits).toBe(1);
  });

  it('should show how many times the task was done when more than once (AC3.5)', async () => {
    const once = await render(card({ count: 1, done: { at: '09:15', by: 'Jéssica' } }));
    expect(once.querySelector('.task-card__count')).toBeNull();

    TestBed.resetTestingModule();
    const twice = await render(card({ count: 2, done: { at: '09:15', by: 'Jéssica' } }));
    expect(twice.querySelector('.task-card__count')?.textContent).toContain('today.doneCount');
  });
});
