import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

export type StatusChipVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChipComponent {
  readonly variant = input<StatusChipVariant>('neutral');
  readonly label = input.required<string>();
  readonly icon = input<string | null>(null);
  readonly showIcon = input(true);

  protected readonly resolvedIcon = computed(() => {
    const explicitIcon = this.icon();

    if (explicitIcon) {
      return explicitIcon;
    }

    const icons: Record<StatusChipVariant, string> = {
      success: 'circle-check',
      warning: 'triangle-alert',
      danger: 'circle-alert',
      info: 'info',
      neutral: 'circle',
    };

    return icons[this.variant()];
  });
}
