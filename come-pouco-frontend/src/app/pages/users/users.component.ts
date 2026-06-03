import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { COMPANY_ROLE_LABEL, type CompanyRole } from '../../core/models/company-role.model';
import { Company } from '../../core/models/company.model';
import { UpdateUserPayload, User } from '../../core/models/user.model';
import { USER_ROLE_LABEL, type UserRole } from '../../core/models/user-role.model';
import { CompanyService } from '../../core/services/company.service';
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
import {
  getStrongPasswordErrorMessage,
  strongPasswordValidator,
} from '../../shared/validators/strong-password.validator';

@Component({
  selector: 'app-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    CrudDrawerComponent,
    EmptyStateComponent,
    IconButtonComponent,
    IconComponent,
    PageHeaderComponent,
    ResponsiveTableComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly companyService = inject(CompanyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly refresh$ = new Subject<void>();
  protected readonly pageSizeOptions = [10, 20, 50, 100];
  protected readonly pageState$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: 20,
  });

  protected readonly displayedColumns: string[] = [
    'id',
    'fullName',
    'role',
    'company',
    'publicSlug',
    'createdAt',
    'actions',
  ];
  protected readonly roleOptions: UserRole[] = ['ADMIN', 'USER'];
  protected readonly companyRoleOptions: CompanyRole[] = ['OWNER', 'EMPLOYEE'];
  protected companies: Company[] = [];
  protected filteredCompanies: Company[] = [];
  protected isSaving = false;

  protected readonly drawerOpen = signal(false);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly drawerError = signal<string | null>(null);

  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly totalUsers$ = new BehaviorSubject<number>(0);
  protected readonly searchControl = this.formBuilder.control('', { nonNullable: true });
  private readonly userSearch$ = new BehaviorSubject<string>('');

  protected readonly users$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.pageState$,
    this.userSearch$,
  ]).pipe(
    debounceTime(0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(([, pageState, search]) =>
      this.userService
        .listUsers({
          page: pageState.pageIndex + 1,
          limit: pageState.pageSize,
          search,
        })
        .pipe(
          map((response) => {
            const rawUsers = Array.isArray(response?.users) ? response.users : [];
            const users = rawUsers.filter((user): user is User => this.isValidUserRow(user));
            this.totalUsers$.next(this.resolveTableTotal(response.meta?.total, rawUsers, users));
            return users;
          }),
          catchError((error) => {
            this.errorMessage$.next(
              error?.error?.message || 'Nao foi possivel carregar os usuarios.',
            );
            this.totalUsers$.next(0);
            return of([] as User[]);
          }),
          finalize(() => this.isLoading$.next(false)),
        ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    email: ['', [Validators.email]],
    password: ['', [strongPasswordValidator]],
    role: ['USER' as UserRole, [Validators.required]],
    companyId: [null as number | null],
    companyRole: ['EMPLOYEE' as CompanyRole],
    companySearch: [''],
    publicSlug: [''],
  });

  ngOnInit(): void {
    this.loadCompanies();

    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
      )
      .subscribe((search) => {
        this.userSearch$.next(search);

        const pageState = this.pageState$.value;
        if (pageState.pageIndex !== 0) {
          this.pageState$.next({ ...pageState, pageIndex: 0 });
        }
      });

    this.form.controls.companySearch.valueChanges.subscribe((value) => {
      this.applyCompanyFilter(value || '');

      const normalized = (value || '').trim().toLowerCase();
      const selectedCompany = this.companies.find(
        (company) => company.name.toLowerCase() === normalized,
      );

      if (!selectedCompany) {
        this.form.controls.companyId.setValue(null, { emitEvent: false });
      }
    });
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

  protected loadUsers(): void {
    this.refresh$.next();
    this.loadCompanies();
  }

  protected handlePage(event: PageEvent): void {
    this.pageState$.next({
      pageIndex: event.pageIndex,
      pageSize: event.pageSize,
    });
  }

  protected clearUserSearch(): void {
    if (!this.searchControl.value) {
      return;
    }

    this.searchControl.setValue('');
  }

  protected openCreate(): void {
    this.editingUser.set(null);
    this.drawerError.set(null);
    this.form.reset({
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'USER',
      companyId: null,
      companyRole: 'EMPLOYEE',
      companySearch: '',
      publicSlug: '',
    });
    this.applyCompanyFilter('');
    this.drawerOpen.set(true);
  }

  protected openEdit(user: User): void {
    this.editingUser.set(user);
    this.drawerError.set(null);
    this.form.reset({
      fullName: user.fullName,
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      companyId: user.companyId ?? null,
      companyRole: (user.companyRole ?? 'EMPLOYEE') as CompanyRole,
      companySearch: user.companyId ? this.userCompanyLabel(user) : '',
      publicSlug: user.publicSlug || '',
    });
    this.applyCompanyFilter(this.form.controls.companySearch.value || '');
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    if (this.isSaving) {
      return;
    }
    this.drawerOpen.set(false);
    this.editingUser.set(null);
    this.drawerError.set(null);
  }

  protected passwordErrorMessage(): string {
    return getStrongPasswordErrorMessage(this.form.controls.password);
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, username, email, password, role, companyId, companyRole, publicSlug } =
      this.form.getRawValue();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedSlug = this.slugify((publicSlug || '').trim());

    if (this.isCreateMode() && !password) {
      this.drawerError.set('A senha e obrigatoria para criar usuario.');
      return;
    }

    if (!role) {
      this.drawerError.set('Selecione um perfil para o usuario.');
      return;
    }

    if (role === 'USER' && !companyId) {
      this.drawerError.set('Selecione uma empresa para usuario do tipo USER.');
      return;
    }

    this.isSaving = true;
    this.drawerError.set(null);

    if (this.isCreateMode()) {
      this.userService
        .createUser({
          fullName: fullName!,
          username: username!,
          email: normalizedEmail || null,
          password: password!,
          role,
          companyId: role === 'USER' ? companyId : null,
          companyRole: role === 'USER' ? (companyRole as CompanyRole) : null,
          publicSlug: normalizedSlug || null,
        })
        .subscribe({
          next: ({ user }) => {
            this.isSaving = false;
            this.drawerOpen.set(false);
            this.editingUser.set(null);
            this.snackBar.open(`Usuario ${user.fullName} criado com sucesso.`, 'OK', {
              duration: 4000,
            });
            this.refresh$.next();
          },
          error: (error) => {
            this.isSaving = false;
            this.drawerError.set(error?.error?.message || 'Nao foi possivel criar usuario.');
          },
        });
      return;
    }

    const payload: UpdateUserPayload = {
      fullName: fullName || undefined,
      username: username || undefined,
      email: normalizedEmail || null,
      role,
      companyId: role === 'USER' ? companyId : null,
      companyRole: role === 'USER' ? (companyRole as CompanyRole) : null,
      publicSlug: normalizedSlug || null,
    };

    if (password) {
      payload.password = password;
    }

    this.userService.updateUser(this.editingUser()!.id, payload).subscribe({
      next: ({ user }) => {
        this.isSaving = false;
        this.drawerOpen.set(false);
        this.editingUser.set(null);
        this.snackBar.open(`Usuario ${user.fullName} atualizado com sucesso.`, 'OK', {
          duration: 4000,
        });
        this.refresh$.next();
      },
      error: (error) => {
        this.isSaving = false;
        this.drawerError.set(error?.error?.message || 'Nao foi possivel atualizar usuario.');
      },
    });
  }

  protected removeUser(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Excluir usuario',
        message: `Deseja realmente excluir ${user.fullName}? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          if (this.editingUser()?.id === user.id) {
            this.closeDrawer();
          }
          this.snackBar.open(`Usuario ${user.fullName} removido com sucesso.`, 'OK', {
            duration: 4000,
          });
          this.refresh$.next();
        },
        error: (error) => {
          this.snackBar.open(
            error?.error?.message || 'Nao foi possivel remover usuario.',
            'Fechar',
            { duration: 4000 },
          );
        },
      });
    });
  }

  protected resetTwoFactor(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Resetar 2FA',
        message: `Resetar 2FA do usuario ${user.username}? Isso desativara 2FA, removera dispositivos confiaveis e backup codes.`,
        confirmText: 'Resetar 2FA',
        tone: 'warning',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.userService.resetTwoFactor(user.id).subscribe({
        next: () => {
          this.snackBar.open('2FA resetado com sucesso.', 'Fechar', { duration: 3000 });
          this.refresh$.next();
        },
        error: () => {
          this.snackBar.open('Falha ao resetar 2FA.', 'Fechar', { duration: 3500 });
        },
      });
    });
  }

  protected onCompanySelected(company: Company, isUserInput: boolean): void {
    if (!isUserInput) {
      return;
    }

    this.form.controls.companyId.setValue(company.id);
    this.form.controls.companySearch.setValue(company.name, { emitEvent: false });
  }

  protected clearSelectedCompany(): void {
    this.form.controls.companyId.setValue(null);
    this.form.controls.companySearch.setValue('');
    this.applyCompanyFilter('');
  }

  protected isCreateMode(): boolean {
    return this.editingUser() === null;
  }

  protected roleLabel(role: UserRole): string {
    return USER_ROLE_LABEL[role];
  }

  protected companyRoleLabel(companyRole: CompanyRole | null): string {
    if (!companyRole) {
      return '-';
    }

    return COMPANY_ROLE_LABEL[companyRole];
  }

  protected companyLabel(companyId: number | null): string {
    if (!companyId) {
      return '-';
    }

    const company = this.companies.find((item) => item.id === companyId);
    return company ? company.name : 'Empresa nao encontrada';
  }

  protected userCompanyLabel(user: User): string {
    if (!user.companyId) {
      return '-';
    }

    const companyName = user.companyName?.trim();
    if (companyName) {
      return companyName;
    }

    return this.companyLabel(user.companyId);
  }

  private applyCompanyFilter(search: string): void {
    const normalized = search.trim().toLowerCase();

    this.filteredCompanies = this.companies.filter((company) => {
      if (!normalized.length) {
        return true;
      }

      return company.name.toLowerCase().includes(normalized);
    });
  }

  private slugify(value: string): string {
    if (!value) {
      return '';
    }
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
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
      typeof candidate.username === 'string' &&
      candidate.username.trim().length > 0 &&
      (candidate.role === 'ADMIN' || candidate.role === 'USER') &&
      typeof candidate.createdAt === 'string' &&
      candidate.createdAt.trim().length > 0
    );
  }

  private resolveTableTotal(
    metaTotal: number | undefined,
    rawRows: unknown[],
    validRows: User[],
  ): number {
    return rawRows.length === validRows.length ? (metaTotal ?? validRows.length) : validRows.length;
  }
}
