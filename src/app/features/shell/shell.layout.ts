import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Main column of the signed-in screens; navigation and preferences live in the site header. */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  selector: 'app-shell-layout',
  styleUrl: './shell.layout.css',
  templateUrl: './shell.layout.html',
})
export class ShellLayoutComponent {}
