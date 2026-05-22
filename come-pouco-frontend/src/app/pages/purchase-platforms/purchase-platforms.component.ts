import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  finalize,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { Company } from '../../core/models/company.model';
import {
  ApiUsageLog,
  ApiUsageMode,
  ApiUsageSummary,
  CreatePurchasePlatformPayload,
  PurchasePlatform,
  UpdatePurchasePlatformPayload,
} from '../../core/models/purchase-platform.model';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';
import { UserService } from '../../core/services/user.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  CrudDrawerComponent,
  EmptyStateComponent,
  IconButtonComponent,
  IconComponent,
  PageHeaderComponent,
  ResponsiveTableComponent,
  SkeletonLoaderComponent,
  StatusChipComponent,
} from '../../shared/components';

const SHOPEE_API_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

@Component({
  selector: 'app-purchase-platforms',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTableModule,
    MatToolbarModule,
    CrudDrawerComponent,
    EmptyStateComponent,
    IconButtonComponent,
    IconComponent,
    PageHeaderComponent,
    ResponsiveTableComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './purchase-platforms.component.html',
  styleUrl: './purchase-platforms.component.scss',
})
export class PurchasePlatformsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly purchasePlatformService = inject(PurchasePlatformService);
  private readonly companyService = inject(CompanyService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly authService = inject(AuthService);

  private readonly refresh$ = new Subject<void>();
  private readonly usageLoading$ = new BehaviorSubject<boolean>(false);
  private readonly usageError$ = new BehaviorSubject<string | null>(null);
  protected readonly pageSizeOptions = [10, 20, 50, 100];
  protected readonly pageState$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: 20,
  });
  protected readonly usagePageSizeOptions = [10, 20, 50, 100];
  protected readonly usagePageState$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>(
    {
      pageIndex: 0,
      pageSize: 20,
    },
  );

  protected readonly platformTypes: Array<'SHOPEE'> = ['SHOPEE'];
  protected readonly usageModeOptions: Array<{ label: string; value: 'ALL' | ApiUsageMode }> = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Mock', value: 'MOCK' },
    { label: 'Real', value: 'REAL' },
  ];
  protected readonly displayedColumns: string[] = [
    'id',
    'name',
    'status',
    'mode',
    'secret',
    'updatedAt',
    'actions',
  ];
  protected readonly usageDisplayedColumns: string[] = [
    'createdAt',
    'mode',
    'companyId',
    'userId',
    'endpoint',
    'success',
  ];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly error$ = new BehaviorSubject<string | null>(null);
  protected readonly totalPlatforms$ = new BehaviorSubject<number>(0);
  protected readonly totalUsageLogs$ = new BehaviorSubject<number>(0);

  protected readonly drawerOpen = signal(false);
  protected readonly editingPlatform = signal<PurchasePlatform | null>(null);
  protected readonly drawerError = signal<string | null>(null);

  protected readonly usageForm = this.formBuilder.group({
    companyId: [null as number | null],
    userId: [{ value: null as number | null, disabled: true }],
    mode: ['ALL' as 'ALL' | ApiUsageMode],
    startDate: [null as Date | null],
    endDate: [null as Date | null],
  });
  protected readonly platforms$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.pageState$,
  ]).pipe(
    tap(() => {
      this.isLoading$.next(true);
      this.error$.next(null);
    }),
    switchMap(([, pageState]) =>
      this.purchasePlatformService
        .list({ page: pageState.pageIndex + 1, limit: pageState.pageSize })
        .pipe(
          map((response) => {
            const rawPlatforms = Array.isArray(response?.platforms) ? response.platforms : [];
            const platforms = rawPlatforms.filter((platform): platform is PurchasePlatform =>
              this.isValidPlatformRow(platform),
            );
            this.totalPlatforms$.next(
              this.resolveTableTotal(response.meta?.total, rawPlatforms, platforms),
            );
            return platforms;
          }),
          catchError((error) => {
            this.error$.next(error?.error?.message || 'Nao foi possivel carregar as plataformas.');
            this.totalPlatforms$.next(0);
            return of([] as PurchasePlatform[]);
          }),
          finalize(() => this.isLoading$.next(false)),
        ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly companies$ = this.companyService.listAll().pipe(
    map((companies) =>
      (Array.isArray(companies) ? companies : []).filter((company): company is Company =>
        this.isValidCompanyRow(company),
      ),
    ),
    catchError(() => of([] as Company[])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly users$ = this.userService.listAllUsers().pipe(
    map((users) =>
      (Array.isArray(users) ? users : []).filter((user): user is User => this.isValidUserRow(user)),
    ),
    catchError(() => of([] as User[])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly filteredEmployees$ = combineLatest([
    this.users$,
    this.usageForm.controls.companyId.valueChanges.pipe(
      startWith(this.usageForm.controls.companyId.value),
    ),
  ]).pipe(
    map(([users, companyId]) => {
      if (!companyId) {
        return [] as User[];
      }

      return users.filter((user) => user.role === 'USER' && user.companyId === companyId);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly usage$ = combineLatest([
    merge(this.refresh$, this.usageForm.valueChanges).pipe(startWith(void 0)),
    this.usagePageState$,
  ]).pipe(
    tap(() => {
      this.usageLoading$.next(true);
      this.usageError$.next(null);
    }),
    switchMap(([, pageState]) =>
      this.purchasePlatformService.getApiUsage(this.buildUsageFilters(pageState)).pipe(
        map((response) => this.normalizeUsageSummary(response)),
        catchError((error) => {
          this.usageError$.next(
            error?.error?.message || 'Nao foi possivel carregar o monitoramento de API.',
          );
          this.totalUsageLogs$.next(0);
          return of({
            totalMock: 0,
            totalReal: 0,
            totalGeral: 0,
            logs: [],
            items: [],
            data: [],
          } satisfies ApiUsageSummary);
        }),
        finalize(() => this.usageLoading$.next(false)),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly usageLoadingState$ = this.usageLoading$.asObservable();
  protected readonly usageErrorState$ = this.usageError$.asObservable();
  protected companies: Company[] = [];
  protected filteredCompanies: Company[] = [];
  protected selectedCompanyIds: number[] = [];
  protected defaultCompanyIds = new Set<number>();
  protected isSaving = false;

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(3)]],
    type: ['SHOPEE' as const, [Validators.required]],
    appId: ['', [Validators.required]],
    secret: ['', [Validators.required, Validators.minLength(3)]],
    isActive: [true],
    mockMode: [false],
    apiUrl: [SHOPEE_API_URL, [Validators.required]],
    apiLink: [SHOPEE_API_URL, [Validators.required]],
    accessKey: [''],
    companySearch: [''],
  });

  ngOnInit(): void {
    this.loadPlatforms();
    this.loadCompanies();

    this.form.controls.type.valueChanges.subscribe(() => {
      this.applyTypeValidators();
    });

    this.form.controls.companySearch.valueChanges.subscribe((value) => {
      this.applyCompanyFilter(value || '');
    });

    this.usageForm.controls.companyId.valueChanges.subscribe((companyId) => {
      const userIdControl = this.usageForm.controls.userId;
      if (companyId) {
        userIdControl.enable({ emitEvent: false });
      } else {
        userIdControl.disable({ emitEvent: false });
      }
      if (userIdControl.value !== null) {
        userIdControl.setValue(null);
      }
    });

    this.applyTypeValidators();
  }

  protected loadPlatforms(): void {
    this.refresh$.next();
  }

  protected handlePage(event: PageEvent): void {
    this.pageState$.next({
      pageIndex: event.pageIndex,
      pageSize: event.pageSize,
    });
  }

  protected handleUsagePage(event: PageEvent): void {
    this.usagePageState$.next({
      pageIndex: event.pageIndex,
      pageSize: event.pageSize,
    });
  }

  protected resetUsageFilters(): void {
    this.usageForm.reset({
      companyId: null,
      userId: null,
      mode: 'ALL',
      startDate: null,
      endDate: null,
    });
    this.refresh$.next();
  }

  protected loadCompanies(): void {
    this.companyService.listAll().subscribe({
      next: (companies) => {
        this.companies = Array.isArray(companies) ? companies : [];
        this.applyCompanyFilter(this.form.controls.companySearch.value || '');
      },
      error: () => {
        this.companies = [];
        this.filteredCompanies = [];
      },
    });
  }

  protected openCreate(): void {
    this.editingPlatform.set(null);
    this.drawerError.set(null);
    this.selectedCompanyIds = [];
    this.defaultCompanyIds.clear();
    this.form.reset({
      name: '',
      description: '',
      type: 'SHOPEE',
      appId: '',
      secret: '',
      isActive: true,
      mockMode: false,
      apiUrl: SHOPEE_API_URL,
      apiLink: SHOPEE_API_URL,
      accessKey: '',
      companySearch: '',
    });
    this.applyCompanyFilter('');
    this.applyTypeValidators();
    this.drawerOpen.set(true);
  }

  protected openEdit(platform: PurchasePlatform): void {
    this.editingPlatform.set(platform);
    this.drawerError.set(null);
    this.selectedCompanyIds = [];
    this.defaultCompanyIds.clear();

    this.form.reset({
      name: platform.name,
      description: platform.description,
      type: platform.type,
      appId: platform.appId,
      secret: '',
      isActive: platform.isActive,
      mockMode: platform.mockMode,
      apiUrl: platform.apiUrl || platform.apiLink || SHOPEE_API_URL,
      apiLink: platform.apiLink || platform.apiUrl || SHOPEE_API_URL,
      accessKey: '',
      companySearch: '',
    });

    this.purchasePlatformService.listCompanies(platform.id).subscribe({
      next: ({ companies }) => {
        const links = Array.isArray(companies) ? companies : [];
        this.selectedCompanyIds = links.map((item) => item.companyId);
        this.defaultCompanyIds = new Set(
          links.filter((item) => item.isDefaultForCompany).map((item) => item.companyId),
        );
        this.ensureDefaultWhenSingleSelected();
        this.applyCompanyFilter('');
      },
      error: () => {
        this.selectedCompanyIds = [];
        this.defaultCompanyIds.clear();
      },
    });

    this.applyTypeValidators();
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    if (this.isSaving) {
      return;
    }
    this.drawerOpen.set(false);
    this.editingPlatform.set(null);
    this.drawerError.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description, type, appId, secret, isActive, mockMode, apiUrl, apiLink } =
      this.form.getRawValue();

    if (!this.isValidUrl(apiUrl!)) {
      this.drawerError.set('Informe uma URL valida para o link da API.');
      return;
    }

    this.isSaving = true;
    this.drawerError.set(null);

    const persistLinks = (platformId: number, platformName: string): void => {
      this.purchasePlatformService
        .updateCompanies(platformId, {
          companyIds: [...this.selectedCompanyIds],
          defaultCompanyIds: [...this.defaultCompanyIds],
        })
        .subscribe({
          next: () => {
            this.isSaving = false;
            this.drawerOpen.set(false);
            this.editingPlatform.set(null);
            this.snackBar.open(`Plataforma ${platformName} salva com sucesso.`, 'OK', {
              duration: 4000,
            });
            this.refresh$.next();
          },
          error: (error) => {
            this.isSaving = false;
            this.drawerError.set(
              error?.error?.message || 'Plataforma salva, mas falhou ao vincular empresas.',
            );
            this.refresh$.next();
          },
        });
    };

    if (this.isCreateMode()) {
      const payload: CreatePurchasePlatformPayload = {
        name: name!,
        description: description!,
        type: type!,
        appId: appId!,
        secret: secret!,
        isActive: Boolean(isActive),
        mockMode: Boolean(mockMode),
        apiUrl: apiUrl!,
        apiLink: apiLink || apiUrl!,
        accessKey: secret!,
      };

      this.purchasePlatformService.create(payload).subscribe({
        next: ({ platform }) => {
          persistLinks(platform.id, platform.name);
        },
        error: (error) => {
          this.isSaving = false;
          this.drawerError.set(error?.error?.message || 'Nao foi possivel criar a plataforma.');
        },
      });

      return;
    }

    const payload: UpdatePurchasePlatformPayload = {
      name: name || undefined,
      description: description || undefined,
      type: type || undefined,
      appId: appId || undefined,
      secret: secret || undefined,
      isActive: Boolean(isActive),
      mockMode: Boolean(mockMode),
      apiUrl: apiUrl || undefined,
      apiLink: apiLink || apiUrl || undefined,
      accessKey: secret || undefined,
    };

    this.purchasePlatformService.update(this.editingPlatform()!.id, payload).subscribe({
      next: ({ platform }) => {
        persistLinks(platform.id, platform.name);
      },
      error: (error) => {
        this.isSaving = false;
        this.drawerError.set(error?.error?.message || 'Nao foi possivel atualizar a plataforma.');
      },
    });
  }

  protected remove(platform: PurchasePlatform): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Excluir plataforma',
        message: `Deseja realmente excluir a plataforma ${platform.name}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.purchasePlatformService.delete(platform.id).subscribe({
        next: () => {
          if (this.editingPlatform()?.id === platform.id) {
            this.closeDrawer();
          }
          this.snackBar.open(`Plataforma ${platform.name} removida com sucesso.`, 'OK', {
            duration: 4000,
          });
          this.refresh$.next();
        },
        error: (error) => {
          this.snackBar.open(
            error?.error?.message || 'Nao foi possivel remover a plataforma.',
            'Fechar',
            { duration: 4000 },
          );
        },
      });
    });
  }

  protected selectCompany(company: Company, isUserInput: boolean): void {
    if (!isUserInput) {
      return;
    }

    this.selectCompanyById(company.id);
  }

  private selectCompanyById(companyId: number): void {
    if (!this.selectedCompanyIds.includes(companyId)) {
      this.selectedCompanyIds = [...this.selectedCompanyIds, companyId];
    }

    this.ensureDefaultWhenSingleSelected();
    this.form.controls.companySearch.setValue('');
    this.applyCompanyFilter('');
  }

  protected removeCompany(companyId: number): void {
    this.selectedCompanyIds = this.selectedCompanyIds.filter((id) => id !== companyId);
    this.defaultCompanyIds.delete(companyId);
    this.ensureDefaultWhenSingleSelected();
    this.applyCompanyFilter(this.form.controls.companySearch.value || '');
  }

  protected isDefaultCompany(companyId: number): boolean {
    return this.defaultCompanyIds.has(companyId);
  }

  protected toggleDefaultCompany(companyId: number, checked: boolean): void {
    if (checked) {
      this.defaultCompanyIds.add(companyId);
    } else {
      this.defaultCompanyIds.delete(companyId);
    }
  }

  protected selectedCompanyLabel(companyId: number): string {
    return this.companies.find((company) => company.id === companyId)?.name || `#${companyId}`;
  }

  protected resetMockUsage(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Zerar contador Mock',
        message: 'Deseja remover os registros MOCK com os filtros atuais?',
        confirmText: 'Zerar Mock',
        tone: 'warning',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      const filters = this.buildUsageFilters();
      this.purchasePlatformService
        .deleteMockApiUsage({
          companyId: filters.companyId,
          startDate: filters.startDate,
          endDate: filters.endDate,
        })
        .subscribe({
          next: ({ deletedCount }) => {
            this.snackBar.open(`${deletedCount} registro(s) MOCK removido(s).`, 'Fechar', {
              duration: 3000,
            });
            this.refresh$.next();
          },
          error: (error) => {
            this.snackBar.open(error?.error?.message || 'Falha ao zerar contador MOCK.', 'Fechar', {
              duration: 3500,
            });
          },
        });
    });
  }

  protected isCreateMode(): boolean {
    return this.editingPlatform() === null;
  }

  protected secretStatus(platform: PurchasePlatform): string {
    return platform.secretConfigured ? 'configurado' : 'nao configurado';
  }

  protected modeStatus(platform: PurchasePlatform): string {
    return platform.mockMode ? 'MOCK' : 'REAL';
  }

  private normalizeUsageSummary(response: ApiUsageSummary): ApiUsageSummary {
    const rawLogs = this.getUsageRows(response);
    const logs = rawLogs.filter((usageLog): usageLog is ApiUsageLog =>
      this.isValidUsageLogRow(usageLog),
    );
    const total = this.resolveTableTotal(
      response.meta?.total ?? response.totalGeral,
      rawLogs,
      logs,
    );
    this.totalUsageLogs$.next(total);

    return {
      ...response,
      totalGeral: total,
      logs,
      items: logs,
      data: logs,
    };
  }

  private getUsageRows(response: ApiUsageSummary): unknown[] {
    if (Array.isArray(response.items)) {
      return response.items;
    }

    if (Array.isArray(response.logs)) {
      return response.logs;
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  private isValidPlatformRow(platform: unknown): platform is PurchasePlatform {
    if (!platform || typeof platform !== 'object') {
      return false;
    }

    const candidate = platform as Partial<PurchasePlatform>;

    return (
      typeof candidate.id === 'number' &&
      Number.isFinite(candidate.id) &&
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      candidate.type === 'SHOPEE' &&
      typeof candidate.updatedAt === 'string' &&
      candidate.updatedAt.trim().length > 0
    );
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
      candidate.name.trim().length > 0
    );
  }

  private isValidUserRow(user: unknown): user is User {
    if (!user || typeof user !== 'object') {
      return false;
    }

    const candidate = user as Partial<User>;

    return (
      typeof candidate.id === 'number' &&
      Number.isFinite(candidate.id) &&
      typeof candidate.fullName === 'string' &&
      candidate.fullName.trim().length > 0 &&
      candidate.role === 'USER'
    );
  }

  private isValidUsageLogRow(usageLog: unknown): usageLog is ApiUsageLog {
    if (!usageLog || typeof usageLog !== 'object') {
      return false;
    }

    const candidate = usageLog as Partial<ApiUsageLog>;

    return (
      typeof candidate.createdAt === 'string' &&
      candidate.createdAt.trim().length > 0 &&
      (candidate.mode === 'MOCK' || candidate.mode === 'REAL') &&
      typeof candidate.companyId === 'number' &&
      Number.isFinite(candidate.companyId) &&
      typeof candidate.userId === 'number' &&
      Number.isFinite(candidate.userId)
    );
  }

  private resolveTableTotal<T>(
    metaTotal: number | undefined,
    rawRows: unknown[],
    validRows: T[],
  ): number {
    return rawRows.length === validRows.length ? (metaTotal ?? validRows.length) : validRows.length;
  }

  private applyTypeValidators(): void {
    const isShopee = this.form.controls.type.value === 'SHOPEE';

    if (isShopee) {
      this.form.controls.appId.setValidators([Validators.required]);
      this.form.controls.secret.setValidators([Validators.required, Validators.minLength(3)]);
    } else {
      this.form.controls.appId.clearValidators();
      this.form.controls.secret.clearValidators();
    }

    this.form.controls.appId.updateValueAndValidity({ emitEvent: false });
    this.form.controls.secret.updateValueAndValidity({ emitEvent: false });
  }

  private applyCompanyFilter(search: string): void {
    const normalized = search.trim().toLowerCase();
    this.filteredCompanies = this.companies.filter((company) => {
      if (this.selectedCompanyIds.includes(company.id)) {
        return false;
      }

      if (!normalized.length) {
        return true;
      }

      return company.name.toLowerCase().includes(normalized);
    });
  }

  private ensureDefaultWhenSingleSelected(): void {
    if (this.selectedCompanyIds.length !== 1) {
      return;
    }

    const onlyCompanyId = this.selectedCompanyIds[0];
    const hasDefaultForAnySelected = this.selectedCompanyIds.some((companyId) =>
      this.defaultCompanyIds.has(companyId),
    );

    if (!hasDefaultForAnySelected) {
      this.defaultCompanyIds.add(onlyCompanyId);
    }
  }

  private isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private buildUsageFilters(pageState = this.usagePageState$.getValue()): {
    companyId?: number;
    userId?: number;
    startDate?: string;
    endDate?: string;
    mode?: ApiUsageMode;
    page?: number;
    limit?: number;
  } {
    const { companyId, userId, startDate, endDate, mode } = this.usageForm.getRawValue();
    const filters: {
      companyId?: number;
      userId?: number;
      startDate?: string;
      endDate?: string;
      mode?: ApiUsageMode;
      page?: number;
      limit?: number;
    } = {};

    if (companyId) {
      filters.companyId = companyId;
    }

    if (userId) {
      filters.userId = userId;
    }

    if (startDate) {
      filters.startDate = this.toDateOnly(startDate);
    }

    if (endDate) {
      filters.endDate = this.toDateOnly(endDate);
    }

    if (mode && mode !== 'ALL') {
      filters.mode = mode;
    }

    filters.page = pageState.pageIndex + 1;
    filters.limit = pageState.pageSize;

    return filters;
  }

  private toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
