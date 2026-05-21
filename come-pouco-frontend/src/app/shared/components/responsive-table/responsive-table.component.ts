import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-responsive-table',
  standalone: true,
  templateUrl: './responsive-table.component.html',
  styleUrl: './responsive-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponsiveTableComponent {
  readonly label = input<string>('Tabela responsiva');
}
