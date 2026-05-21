import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonLoaderVariant = 'text' | 'card' | 'table-row' | 'avatar';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonLoaderComponent {
  readonly variant = input<SkeletonLoaderVariant>('text');
  readonly lines = input(3);
  readonly label = input('Carregando');

  protected readonly rows = computed(() => Array.from({ length: Math.max(1, this.lines()) }));
}
