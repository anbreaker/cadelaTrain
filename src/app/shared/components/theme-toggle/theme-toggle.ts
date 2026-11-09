import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ScreenPoint } from '@core/utils/theme-transition';

/** Keyboard activation reports no pointer position (`detail === 0`), so the button centre is used. */
const originOf = (event: MouseEvent, button: HTMLElement): ScreenPoint => {
  if (event.detail > 0) return { x: event.clientX, y: event.clientY };

  const box = button.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/**
 * Icon button: shows the current theme (moon when dark, sun when light) and, on hover or focus,
 * the theme it switches to. Emits where it was activated so the reveal can start there.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslocoDirective],
  selector: 'app-theme-toggle',
  styleUrl: './theme-toggle.css',
  templateUrl: './theme-toggle.html',
})
export class ThemeToggleComponent {
  readonly isDark = input.required<boolean>();

  readonly toggle = output<ScreenPoint>();

  protected activate(event: MouseEvent): void {
    this.toggle.emit(originOf(event, event.currentTarget as HTMLElement));
  }
}
