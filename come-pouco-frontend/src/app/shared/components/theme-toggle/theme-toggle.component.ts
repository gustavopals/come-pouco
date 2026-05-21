import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThemePreference, ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../icon/icon.component';

type ThemeOption = {
  value: ThemePreference;
  label: string;
  icon: string;
};

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatButtonModule, MatMenuModule, MatTooltipModule, IconComponent],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly options: ThemeOption[] = [
    { value: 'system', label: 'Sistema', icon: 'monitor' },
    { value: 'light', label: 'Claro', icon: 'sun' },
    { value: 'dark', label: 'Escuro', icon: 'moon' },
  ];

  protected setTheme(theme: ThemePreference): void {
    this.themeService.setTheme(theme);
  }

  protected triggerIcon(): string {
    const preference = this.themeService.currentTheme();

    if (preference === 'system') {
      return 'contrast';
    }

    return preference === 'dark' ? 'moon' : 'sun';
  }

  protected triggerLabel(): string {
    const labels: Record<ThemePreference, string> = {
      system: 'Tema do sistema',
      light: 'Tema claro',
      dark: 'Tema escuro',
    };

    return labels[this.themeService.currentTheme()];
  }
}
