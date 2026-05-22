import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  finalize,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { Company } from '../../core/models/company.model';
import { PurchasePlatform } from '../../core/models/purchase-platform.model';
import { CompanyService } from '../../core/services/company.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';
import {
  CrudDrawerComponent,
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  ResponsiveTableComponent,
  SkeletonLoaderComponent,
  StatusChipComponent,
} from '../../shared/components';

@Component({
  selector: 'app-companies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    CrudDrawerComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    ResponsiveTableComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './companies.component.html',
  styleUrl: './companies.component.scss',
})
export class CompaniesComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly purchasePlatformService = inject(PurchasePlatformService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly refresh$ = new Subject<void>();
  protected readonly pageSizeOptions = [10, 20, 50, 100];
  protected readonly pageState$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: 20,
  });

  protected readonly displayedColumns = ['id', 'name', 'platform', 'createdAt', 'actions'];
  protected shopeePlatforms: PurchasePlatform[] = [];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly totalCompanies$ = new BehaviorSubject<number>(0);
  protected isLoadingPlatforms = false;
  protected isSaving = false;

  protected readonly drawerOpen = signal(false);
  protected readonly editingCompany = signal<Company | null>(null);
  protected readonly drawerError = signal<string | null>(null);

  protected readonly companies$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.pageState$,
  ]).pipe(
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(([, pageState]) =>
      this.companyService.list({ page: pageState.pageIndex + 1, limit: pageState.pageSize }).pipe(
        map((response) => {
          const rawCompanies = Array.isArray(response?.companies) ? response.companies : [];
          const companies = rawCompanies.filter((company): company is Company =>
            this.isValidCompanyRow(company),
          );
          this.totalCompanies$.next(
            this.resolveTableTotal(response.meta?.total, rawCompanies, companies),
          );
          return companies;
        }),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar empresas.');
          this.totalCompanies$.next(0);
          return of([] as Company[]);
        }),
        finalize(() => this.isLoading$.next(false)),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    shopeePlatformId: [null as number | null],
  });

  ngOnInit(): void {
    this.loadShopeePlatforms();
  }

  protected loadCompanies(): void {
    this.refresh$.next();
  }

  protected handlePage(event: PageEvent): void {
    this.pageState$.next({
      pageIndex: event.pageIndex,
      pageSize: event.pageSize,
    });
  }

  protected loadShopeePlatforms(): void {
    this.isLoadingPlatforms = true;
    this.form.controls.shopeePlatformId.disable({ emitEvent: false });

    this.purchasePlatformService
      .listAll()
      .pipe(
        finalize(() => {
          this.isLoadingPlatforms = false;
          this.form.controls.shopeePlatformId.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (platforms) => {
          const all = Array.isArray(platforms) ? platforms : [];
          this.shopeePlatforms = all.filter((item) => item.type === 'SHOPEE' && item.isActive);
        },
        error: () => {
          this.shopeePlatforms = [];
        },
      });
  }

  protected openCreate(): void {
    this.editingCompany.set(null);
    this.drawerError.set(null);
    this.form.reset({ name: '', shopeePlatformId: null });
    this.drawerOpen.set(true);
  }

  protected openEdit(company: Company): void {
    this.editingCompany.set(company);
    this.drawerError.set(null);
    this.form.reset({
      name: company.name,
      shopeePlatformId: company.shopeePlatformId ?? null,
    });
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    if (this.isSaving) {
      return;
    }
    this.drawerOpen.set(false);
    this.editingCompany.set(null);
    this.drawerError.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value ?? '';
    const shopeePlatformId = this.form.controls.shopeePlatformId.value;

    this.isSaving = true;
    this.drawerError.set(null);

    const editing = this.editingCompany();

    if (editing === null) {
      this.companyService.create({ name, shopeePlatformId }).subscribe({
        next: ({ company }) => {
          this.isSaving = false;
          this.drawerOpen.set(false);
          this.editingCompany.set(null);
          this.snackBar.open(`Empresa ${company.name} criada com sucesso.`, 'OK', {
            duration: 4000,
          });
          this.refresh$.next();
        },
        error: (error) => {
          this.isSaving = false;
          this.drawerError.set(error?.error?.message || 'Nao foi possivel criar empresa.');
        },
      });

      return;
    }

    this.companyService.update(editing.id, { name, shopeePlatformId }).subscribe({
      next: ({ company }) => {
        this.isSaving = false;
        this.drawerOpen.set(false);
        this.editingCompany.set(null);
        this.snackBar.open(`Empresa ${company.name} atualizada com sucesso.`, 'OK', {
          duration: 4000,
        });
        this.refresh$.next();
      },
      error: (error) => {
        this.isSaving = false;
        this.drawerError.set(error?.error?.message || 'Nao foi possivel atualizar empresa.');
      },
    });
  }

  protected platformLabel(platform: Company['shopeePlatform']): string {
    if (!platform) {
      return 'Nao vinculada';
    }

    return `${platform.name} (${platform.isActive ? 'Ativa' : 'Inativa'})`;
  }

  private isValidCompanyRow(company: unknown): company is Company {
    if (!company || typeof company !== 'object') {
      return false;
    }

    const candidate = company as Partial<Company>;

    return (
      typeof candidate.id === 'number' &&
      Number.isFinite(candidate.id) &&
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      typeof candidate.createdAt === 'string' &&
      candidate.createdAt.trim().length > 0
    );
  }

  private resolveTableTotal(
    metaTotal: number | undefined,
    rawRows: unknown[],
    validRows: Company[],
  ): number {
    return rawRows.length === validRows.length ? (metaTotal ?? validRows.length) : validRows.length;
  }
}
