import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AppLogoComponent } from '../app-logo/app-logo.component';
import { IconComponent } from '../icon/icon.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [AppLogoComponent, IconComponent, ThemeToggleComponent],
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShellComponent {
  readonly eyebrow = input('Acesso seguro');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly featureTitle = input('Painel auralinks');
  readonly featureDescription = input(
    'Controle links, equipes e integrações com autenticação reforçada.',
  );
  readonly featureIcon = input('shield-check');
}
