import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { BehaviorSubject } from 'rxjs';

import {
  AdminStatusResponse,
  HealthStatus,
  Incident,
  IncidentComponentKey,
  IncidentSeverity,
  IncidentStatus,
  IncidentTimelineItem,
  StatusComponent,
} from '../../core/models/admin-status.model';
import { AdminStatusService } from '../../core/services/admin-status.service';
import {
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  SkeletonLoaderComponent,
  StatusChipComponent,
  type StatusChipVariant,
} from '../../shared/components';

@Component({
  selector: 'app-admin-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './admin-status.component.html',
  styleUrl: './admin-status.component.scss',
})
export class AdminStatusComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminStatusService = inject(AdminStatusService);

  protected readonly status$ = new BehaviorSubject<AdminStatusResponse | null>(null);
  protected readonly isLoading$ = new BehaviorSubject<boolean>(true);
  protected readonly isSaving$ = new BehaviorSubject<boolean>(false);
  protected readonly isFormOpen$ = new BehaviorSubject<boolean>(false);
  protected readonly message$ = new BehaviorSubject<string>('');
  protected readonly error$ = new BehaviorSubject<string>('');

  protected readonly components: Array<{ key: IncidentComponentKey; label: string }> = [
    { key: 'backend', label: 'Backend' },
    { key: 'database', label: 'Database' },
    { key: 'shopee', label: 'Shopee API' },
    { key: 'email', label: 'Email Transport' },
    { key: 'cache', label: 'Cache' },
  ];
  protected readonly severities: Array<{ value: IncidentSeverity; label: string }> = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' },
    { value: 'critical', label: 'Critica' },
  ];
  protected readonly statuses: Array<{ value: IncidentStatus; label: string }> = [
    { value: 'investigating', label: 'Investigando' },
    { value: 'identified', label: 'Identificado' },
    { value: 'resolved', label: 'Resolvido' },
  ];

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    severity: ['high' as IncidentSeverity, [Validators.required]],
    status: ['investigating' as IncidentStatus, [Validators.required]],
    affectedComponents: [['backend'] as IncidentComponentKey[], [Validators.required]],
    startedAt: [''],
    resolvedAt: [''],
  });

  ngOnInit(): void {
    this.loadStatus();
  }

  protected loadStatus(): void {
    this.isLoading$.next(true);
    this.error$.next('');

    this.adminStatusService.getStatus().subscribe({
      next: (status) => {
        this.status$.next(status);
        this.isLoading$.next(false);
      },
      error: (error) => {
        this.isLoading$.next(false);
        this.error$.next(error?.error?.message || 'Nao foi possivel carregar a pagina de status.');
      },
    });
  }

  protected openIncidentForm(): void {
    this.isFormOpen$.next(true);
    this.message$.next('');
    this.error$.next('');

    if (!this.form.controls.startedAt.value) {
      this.form.controls.startedAt.setValue(this.toDateTimeLocal(new Date()));
    }
  }

  protected closeIncidentForm(): void {
    this.isFormOpen$.next(false);
    this.form.reset({
      title: '',
      description: '',
      severity: 'high',
      status: 'investigating',
      affectedComponents: ['backend'],
      startedAt: '',
      resolvedAt: '',
    });
  }

  protected createIncident(): void {
    if (this.form.invalid || this.isSaving$.value) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.isSaving$.next(true);
    this.error$.next('');
    this.message$.next('');

    this.adminStatusService
      .createIncident({
        title: value.title,
        description: value.description,
        severity: value.severity,
        status: value.status,
        affectedComponents: value.affectedComponents,
        startedAt: this.toIsoOrUndefined(value.startedAt),
        resolvedAt: this.toIsoOrUndefined(value.resolvedAt),
      })
      .subscribe({
        next: () => {
          this.isSaving$.next(false);
          this.message$.next('Incidente registrado.');
          this.closeIncidentForm();
          this.loadStatus();
        },
        error: (error) => {
          this.isSaving$.next(false);
          this.error$.next(error?.error?.message || 'Nao foi possivel registrar o incidente.');
        },
      });
  }

  protected updateIncidentStatus(incident: Incident, status: IncidentStatus): void {
    this.error$.next('');
    this.message$.next('');

    this.adminStatusService.updateIncident(incident.id, { status }).subscribe({
      next: () => {
        this.message$.next(
          status === 'resolved' ? 'Incidente resolvido.' : 'Incidente atualizado.',
        );
        this.loadStatus();
      },
      error: (error) => {
        this.error$.next(error?.error?.message || 'Nao foi possivel atualizar o incidente.');
      },
    });
  }

  protected statusVariant(status: HealthStatus): StatusChipVariant {
    const variants: Record<HealthStatus, StatusChipVariant> = {
      ok: 'success',
      degraded: 'warning',
      down: 'danger',
    };

    return variants[status];
  }

  protected statusLabel(status: HealthStatus): string {
    const labels: Record<HealthStatus, string> = {
      ok: 'Operacional',
      degraded: 'Degradado',
      down: 'Indisponivel',
    };

    return labels[status];
  }

  protected incidentStatusLabel(status: IncidentStatus): string {
    return this.statuses.find((item) => item.value === status)?.label || status;
  }

  protected incidentStatusVariant(status: IncidentStatus): StatusChipVariant {
    const variants: Record<IncidentStatus, StatusChipVariant> = {
      investigating: 'danger',
      identified: 'warning',
      resolved: 'success',
    };

    return variants[status];
  }

  protected severityLabel(severity: IncidentSeverity): string {
    return this.severities.find((item) => item.value === severity)?.label || severity;
  }

  protected severityVariant(severity: IncidentSeverity): StatusChipVariant {
    const variants: Record<IncidentSeverity, StatusChipVariant> = {
      low: 'info',
      medium: 'warning',
      high: 'danger',
      critical: 'danger',
    };

    return variants[severity];
  }

  protected componentIcon(component: StatusComponent | IncidentComponentKey): string {
    const key = typeof component === 'string' ? component : component.key;
    const icons: Record<IncidentComponentKey, string> = {
      backend: 'server',
      database: 'database',
      shopee: 'shopping-bag',
      email: 'mail',
      cache: 'hard-drive',
    };

    return icons[key];
  }

  protected componentLabel(component: IncidentComponentKey): string {
    return this.components.find((item) => item.key === component)?.label || component;
  }

  protected formatDateTime(value: string | null): string {
    if (!value) {
      return 'Em aberto';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected formatTimelineDate(item: IncidentTimelineItem): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(`${item.date}T00:00:00Z`));
  }

  protected timelineClass(item: IncidentTimelineItem): string {
    if (!item.highestSeverity) {
      return 'timeline-day-empty';
    }

    return `timeline-day-${item.highestSeverity}`;
  }

  private toIsoOrUndefined(value: string): string | undefined {
    if (!value) {
      return undefined;
    }

    return new Date(value).toISOString();
  }

  private toDateTimeLocal(date: Date): string {
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }
}
