import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskKind } from '@domain/guidance';
import { TaskLogDraft } from '@domain/task-log';
import { translocoTesting } from '@shared/testing/transloco-testing';

import { LogSheetComponent } from './log-sheet';

@Component({
  imports: [LogSheetComponent],
  template: `
    <app-log-sheet
      [canRemove]="canRemove()"
      [initial]="initial()"
      [kind]="kind()"
      (cancelled)="cancelled = cancelled + 1"
      (removed)="removed = removed + 1"
      (saved)="saved.push($event)"
    />
  `,
})
class HostComponent {
  readonly canRemove = signal(false);
  readonly initial = signal<null | TaskLogDraft>(null);
  readonly kind = signal<TaskKind>('training');
  readonly saved: TaskLogDraft[] = [];
  cancelled = 0;
  removed = 0;
}

describe('LogSheetComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const render = async (setup: (host: HostComponent) => void = () => undefined): Promise<void> => {
    TestBed.configureTestingModule({ imports: [HostComponent, translocoTesting()] });
    fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    await fixture.whenStable();
  };

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const all = (selector: string): HTMLButtonElement[] => [
    ...element().querySelectorAll<HTMLButtonElement>(selector),
  ];
  const click = async (button: HTMLElement | undefined): Promise<void> => {
    button?.click();
    await fixture.whenStable();
  };
  const save = (): HTMLButtonElement =>
    element().querySelector<HTMLButtonElement>('.log-sheet__save') as HTMLButtonElement;

  beforeEach(() => TestBed.resetTestingModule());

  it('should save a default training log with one tap on the successes (AC3.2, AC3.8)', async () => {
    await render();

    expect(all('.log-sheet__success')).toHaveLength(11);
    expect(save().disabled).toBe(true);

    await click(all('.log-sheet__success')[8]);
    await click(save());

    expect(fixture.componentInstance.saved).toEqual([{ attempts: 10, notes: '', successCount: 8 }]);
  });

  it('should change attempts between 1 and 20 and cap the successes (AC3.2)', async () => {
    await render();
    await click(all('.log-sheet__success')[10]);

    for (let step = 0; step < 12; step++) await click(all('.log-sheet__attempts-less')[0]);

    expect(element().querySelector('.log-sheet__attempts-value')?.textContent?.trim()).toBe('1');
    expect(all('.log-sheet__success')).toHaveLength(2);
    expect(all('.log-sheet__success')[1].getAttribute('aria-pressed')).toBe('true');

    for (let step = 0; step < 25; step++) await click(all('.log-sheet__attempts-more')[0]);
    expect(element().querySelector('.log-sheet__attempts-value')?.textContent?.trim()).toBe('20');
  });

  it('should ask socialization for the reaction (AC3.3)', async () => {
    await render((host) => host.kind.set('socialization'));

    expect(all('.log-sheet__success')).toHaveLength(0);
    expect(all('.log-sheet__reaction').map((button) => button.textContent?.trim())).toEqual([
      'reactions.calm',
      'reactions.curious',
      'reactions.fear',
    ]);

    await click(all('.log-sheet__reaction')[2]);
    await click(save());

    expect(fixture.componentInstance.saved).toEqual([{ notes: '', reaction: 'fear' }]);
  });

  it('should save other kinds with optional notes (AC3.4)', async () => {
    await render((host) => host.kind.set('feeding'));
    const notes = element().querySelector('textarea') as HTMLTextAreaElement;

    expect(notes.maxLength).toBe(1000);
    notes.value = 'Comió todo';
    notes.dispatchEvent(new Event('input'));
    await click(save());

    expect(fixture.componentInstance.saved).toEqual([{ notes: 'Comió todo' }]);
  });

  it('should start from the log being edited and offer delete (AC3.6)', async () => {
    await render((host) => {
      host.initial.set({ attempts: 5, notes: 'ok', successCount: 4 });
      host.canRemove.set(true);
    });

    expect(all('.log-sheet__success')[4].getAttribute('aria-pressed')).toBe('true');
    expect((element().querySelector('textarea') as HTMLTextAreaElement).value).toBe('ok');

    await click(element().querySelector<HTMLElement>('.log-sheet__remove') ?? undefined);
    await click(element().querySelector<HTMLElement>('.log-sheet__cancel') ?? undefined);

    expect(fixture.componentInstance.removed).toBe(1);
    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('should not offer delete for a new log', async () => {
    await render();

    expect(element().querySelector('.log-sheet__remove')).toBeNull();
  });
});
