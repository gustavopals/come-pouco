import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { IconComponent } from '../icon/icon.component';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'ghost' | 'soft' | 'primary' | 'danger';

@Component({
  selector: 'app-icon-button',
  standalone: true,
  imports: [IconComponent, MatTooltipModule],
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButtonComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly tooltip = input<string | null>(null);
  readonly size = input<IconButtonSize>('md');
  readonly variant = input<IconButtonVariant>('ghost');
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');

  readonly pressed = output<MouseEvent>();

  protected readonly iconSize = computed(() => {
    const sizes: Record<IconButtonSize, number> = {
      sm: 16,
      md: 18,
      lg: 20,
    };

    return sizes[this.size()];
  });

  protected handleClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.pressed.emit(event);
  }
}
