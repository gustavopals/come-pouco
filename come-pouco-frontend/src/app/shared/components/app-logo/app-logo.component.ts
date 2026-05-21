import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './app-logo.component.html',
  styleUrl: './app-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogoComponent {
  readonly compact = input(false);
  readonly label = input('auralinks');
}
