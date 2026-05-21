import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import {
  ConversionSummary,
  DashboardService,
  ProductionSummary,
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
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly isProductionLoading$ = new BehaviorSubject<boolean>(true);
  protected readonly isConversionLoading$ = new BehaviorSubject<boolean>(false);
  protected companyName$: Observable<string | null> = of(null);
  protected productionSummary$ = new BehaviorSubject<ProductionSummary | null>(null);
  protected conversionSummary$ = new BehaviorSubject<ConversionSummary | null>(null);

  constructor(
    protected readonly authService: AuthService,
    private readonly companyService: CompanyService,
    private readonly dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();

    if (!user) {
      this.authService.me().subscribe({
        next: () => {
          this.setupCompanyNameStream();
          this.loadProductionSummary();
          this.loadConversionSummary();
        },
        error: () => {
          this.errorMessage$.next('Falha ao carregar dados do usuario.');
          this.authService.logout();
        },
      });
      return;
    }

    this.setupCompanyNameStream();
    this.loadProductionSummary();
    this.loadConversionSummary();
  }

  private loadProductionSummary(): void {
    this.isProductionLoading$.next(true);
    this.dashboardService.getProductionSummary().subscribe({
      next: (summary) => {
        this.productionSummary$.next(summary);
        this.isProductionLoading$.next(false);
      },
      error: () => {
        this.errorMessage$.next('Erro ao carregar resumo de producao.');
        this.isProductionLoading$.next(false);
      },
    });
  }

  private loadConversionSummary(): void {
    if (!this.authService.isAdmin() && !this.authService.isOwner()) {
      this.conversionSummary$.next(null);
      return;
    }

    this.isConversionLoading$.next(true);
    this.dashboardService.getConversionSummary({ range: '7d' }).subscribe({
      next: (summary) => {
        this.conversionSummary$.next(summary.landingActive ? summary : null);
        this.isConversionLoading$.next(false);
      },
      error: () => {
        this.isConversionLoading$.next(false);
      },
    });
  }

  protected roleLabel(): string {
    const user = this.authService.currentUser();

    if (user?.role === 'ADMIN') {
      return 'Administrador';
    }

    if (user?.companyRole === 'OWNER') {
      return 'Dono da empresa';
    }

    if (user?.companyRole === 'EMPLOYEE') {
      return 'Colaborador';
    }

    return 'Usuario padrao';
  }

  protected securityLabel(): string {
    return this.authService.currentUser()?.twoFactorEnabled ? '2FA ativo' : '2FA pendente';
  }

  protected securityVariant(): StatusChipVariant {
    return this.authService.currentUser()?.twoFactorEnabled ? 'success' : 'warning';
  }

  protected productionVariant(summary: ProductionSummary): StatusChipVariant {
    if (summary.todayCount >= summary.avgLast7Days) {
      return 'success';
    }

    if (summary.todayCount === 0) {
      return 'warning';
    }

    return 'info';
  }

  protected productionLabel(summary: ProductionSummary): string {
    if (summary.todayCount >= summary.avgLast7Days) {
      return 'Acima da media';
    }

    if (summary.todayCount === 0) {
      return 'Sem links hoje';
    }

    return 'Em acompanhamento';
  }

  protected conversionVariant(summary: ConversionSummary): StatusChipVariant {
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

  protected conversionLabel(summary: ConversionSummary): string {
    if (summary.total === 0) {
      return 'Sem conversoes';
    }

    if (summary.successRate >= 85) {
      return 'Saudavel';
    }

    if (summary.fallbackRate >= 20) {
      return 'Fallback elevado';
    }

    return 'Em acompanhamento';
  }

  private setupCompanyNameStream(): void {
    const user = this.authService.currentUser();

    if (!user?.companyId) {
      this.companyName$ = of(null);
      return;
    }

    if (user.company?.name) {
      this.companyName$ = of(user.company.name);
      return;
    }

    this.companyName$ = this.companyService.listAll().pipe(
      map((companies) => {
        const company = companies.find((item) => item.id === user.companyId);
        return company?.name ?? null;
      }),
    );
  }
}
