import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { forkJoin } from 'rxjs';

import {
  ConversionByEmployee,
  ConversionDashboardRange,
  ConversionSummary,
  ConversionTimelineBucket,
  ConversionTimelineResponse,
  ConversionTopProduct,
  DashboardService,
} from '../../core/services/dashboard.service';
import {
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  SkeletonLoaderComponent,
  StatusChipComponent,
  type StatusChipVariant,
} from '../../shared/components';

@Component({
  selector: 'app-conversions-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    BaseChartDirective,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './conversions-dashboard.component.html',
  styleUrl: './conversions-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideCharts(withDefaultRegisterables())],
})
export class ConversionsDashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rangeOptions: Array<{ value: ConversionDashboardRange; label: string }> = [
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
  ];
  protected readonly selectedRange = signal<ConversionDashboardRange>('7d');
  protected readonly selectedEmployeeId = signal<number | null>(null);
  protected readonly selectedBucket = signal<ConversionTimelineBucket>('day');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly summary = signal<ConversionSummary | null>(null);
  protected readonly topProducts = signal<ConversionTopProduct[]>([]);
  protected readonly employees = signal<ConversionByEmployee[]>([]);
  protected readonly employeeOptions = signal<ConversionByEmployee[]>([]);
  protected readonly timeline = signal<ConversionTimelineResponse | null>(null);

  protected readonly chartData = computed<ChartData<'line', number[], string>>(() => {
    const items = this.timeline()?.items ?? [];

    return {
      labels: items.map((item) => this.formatBucket(item.bucketStart)),
      datasets: [
        {
          label: 'Sucesso',
          data: items.map((item) => item.success),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.16)',
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Fallback',
          data: items.map((item) => item.fallback),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          tension: 0.35,
        },
        {
          label: 'Erro',
          data: items.map((item) => item.error),
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          tension: 0.35,
        },
      ],
    };
  });

  protected readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  constructor() {
    this.loadDashboard();
  }

  protected setRange(range: ConversionDashboardRange): void {
    if (this.selectedRange() === range) {
      return;
    }

    this.selectedRange.set(range);
    this.loadDashboard();
  }

  protected setEmployee(change: MatSelectChange): void {
    this.selectedEmployeeId.set(change.value ?? null);
    this.loadDashboard();
  }

  protected setBucket(bucket: ConversionTimelineBucket): void {
    if (this.selectedBucket() === bucket) {
      return;
    }

    this.selectedBucket.set(bucket);
    this.loadDashboard();
  }

  protected clearEmployeeFilter(): void {
    this.selectedEmployeeId.set(null);
    this.loadDashboard();
  }

  protected formatPercent(value: number): string {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
  }

  protected summaryVariant(summary: ConversionSummary): StatusChipVariant {
    if (summary.total === 0) {
      return 'neutral';
    }

    if (summary.successRate >= 85) {
      return 'success';
    }

    if (summary.fallbackRate >= 20 || summary.errorCount > 0) {
      return 'warning';
    }

    return 'info';
  }

  protected productLabel(product: ConversionTopProduct): string {
    return product.productName || `Item ${product.itemId}`;
  }

  protected trackProduct(_index: number, product: ConversionTopProduct): string {
    return `${product.itemId}:${product.shopId ?? 'shop'}`;
  }

  protected trackEmployee(_index: number, employee: ConversionByEmployee): string {
    return String(employee.employeeId ?? 'direct');
  }

  private loadDashboard(): void {
    const range = this.selectedRange();
    const employeeId = this.selectedEmployeeId();
    const bucket = this.selectedBucket();
    const filteredParams = { range, employeeId, bucket };

    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      summary: this.dashboardService.getConversionSummary(filteredParams),
      topProducts: this.dashboardService.getConversionTopProducts({ ...filteredParams, limit: 10 }),
      employees: this.dashboardService.getConversionsByEmployee(filteredParams),
      employeeOptions: this.dashboardService.getConversionsByEmployee({ range }),
      timeline: this.dashboardService.getConversionTimeline(filteredParams),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, topProducts, employees, employeeOptions, timeline }) => {
          this.summary.set(summary);
          this.topProducts.set(topProducts.items);
          this.employees.set(employees.items);
          this.employeeOptions.set(employeeOptions.items);
          this.timeline.set(timeline);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Nao foi possivel carregar as conversoes agora.');
          this.isLoading.set(false);
        },
      });
  }

  private formatBucket(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    if (this.selectedBucket() === 'hour') {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
      }).format(date);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  }
}
