import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Subject, catchError, finalize, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { COMPANY_ROLE_LABEL, type CompanyRole } from '../../core/models/company-role.model';
import { Company } from '../../core/models/company.model';
import { UpdateUserPayload, User } from '../../core/models/user.model';
import { USER_ROLE_LABEL, type UserRole } from '../../core/models/user-role.model';
import { CompanyService } from '../../core/services/company.service';
import { UserService } from '../../core/services/user.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

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
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly companyService = inject(CompanyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly refresh$ = new Subject<void>();

  protected readonly displayedColumns: string[] = ['id', 'fullName', 'username', 'email', 'role', 'company', 'createdAt', 'actions'];
  protected readonly roleOptions: UserRole[] = ['ADMIN', 'USER'];
  protected readonly companyRoleOptions: CompanyRole[] = ['OWNER', 'EMPLOYEE'];
  protected companies: Company[] = [];
  protected filteredCompanies: Company[] = [];
  protected isSaving = false;
  protected editingUserId: number | null = null;

  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly successMessage$ = new BehaviorSubject<string | null>(null);

  protected readonly users$ = this.refresh$.pipe(
    startWith(void 0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(() =>
      this.userService.listUsers().pipe(
        map((response) => (Array.isArray(response?.users) ? response.users : [])),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar os usuarios.');
          return of([] as User[]);
        }),
        finalize(() => this.isLoading$.next(false))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  protected readonly totalUsers$ = this.users$.pipe(map((users) => users.length));

  protected readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.minLength(6)]],
    role: ['USER' as UserRole, [Validators.required]],
    companyId: [null as number | null],
    companyRole: ['EMPLOYEE' as CompanyRole],
    companySearch: ['']
  });

  ngOnInit(): void {
    this.loadCompanies();

    this.form.controls.companySearch.valueChanges.subscribe((value) => {
      this.applyCompanyFilter(value || '');

      const normalized = (value || '').trim().toLowerCase();
      const selectedCompany = this.companies.find((company) => company.name.toLowerCase() === normalized);

      if (!selectedCompany) {
        this.form.controls.companyId.setValue(null, { emitEvent: false });
      }
    });
  }

  protected loadCompanies(): void {
    this.companyService.list().subscribe({
      next: ({ companies }) => {
        this.companies = Array.isArray(companies) ? companies : [];
        this.applyCompanyFilter(this.form.controls.companySearch.value || '');
      },
      error: () => {
        this.companies = [];
        this.filteredCompanies = [];
      }
    });
  }

  protected loadUsers(): void {
    this.refresh$.next();
    this.loadCompanies();
  }

  protected startCreate(): void {
    this.editingUserId = null;
    this.form.reset({
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'USER',
      companyId: null,
      companyRole: 'EMPLOYEE',
      companySearch: ''
    });
    this.applyCompanyFilter('');
  }

  protected startEdit(user: User): void {
    this.editingUserId = user.id;
    this.successMessage$.next(null);
    this.errorMessage$.next(null);
    this.form.reset({
      fullName: user.fullName,
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      companyId: user.companyId ?? null,
      companyRole: (user.companyRole ?? 'EMPLOYEE') as CompanyRole,
      companySearch: user.companyId ? this.companyLabel(user.companyId) : ''
    });

    this.applyCompanyFilter(this.form.controls.companySearch.value || '');
  }

  protected cancelEdit(): void {
    this.startCreate();
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, username, email, password, role, companyId, companyRole } = this.form.getRawValue();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (this.isCreateMode() && !password) {
      this.errorMessage$.next('A senha e obrigatoria para criar usuario.');
      return;
    }

    if (!role) {
      this.errorMessage$.next('Selecione um perfil para o usuario.');
      return;
    }

    if (role === 'USER' && !companyId) {
      this.errorMessage$.next('Selecione uma empresa para usuario do tipo USER.');
      return;
    }

    this.isSaving = true;
    this.errorMessage$.next(null);
    this.successMessage$.next(null);

    if (this.isCreateMode()) {
      this.userService
        .createUser({
          fullName: fullName!,
          username: username!,
          email: normalizedEmail || null,
          password: password!,
          role,
          companyId: role === 'USER' ? companyId : null,
          companyRole: role === 'USER' ? (companyRole as CompanyRole) : null
        })
        .subscribe({
          next: ({ user }) => {
            this.isSaving = false;
            this.startCreate();
            this.successMessage$.next(`Usuario ${user.fullName} criado com sucesso.`);
            this.refresh$.next();
          },
          error: (error) => {
            this.isSaving = false;
            this.errorMessage$.next(error?.error?.message || 'Nao foi possivel criar usuario.');
          }
        });

      return;
    }

    const payload: UpdateUserPayload = {
      fullName: fullName || undefined,
      username: username || undefined,
      email: normalizedEmail || null,
      role,
      companyId: role === 'USER' ? companyId : null,
      companyRole: role === 'USER' ? (companyRole as CompanyRole) : null
    };

    if (password) {
      payload.password = password;
    }

    this.userService.updateUser(this.editingUserId!, payload).subscribe({
      next: ({ user }) => {
        this.isSaving = false;
        this.startCreate();
        this.successMessage$.next(`Usuario ${user.fullName} atualizado com sucesso.`);
        this.refresh$.next();
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage$.next(error?.error?.message || 'Nao foi possivel atualizar usuario.');
      }
    });
  }

  protected removeUser(user: User): void {
    if (!confirm(`Deseja realmente excluir ${user.fullName}?`)) {
      return;
    }

    this.errorMessage$.next(null);
    this.successMessage$.next(null);

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        if (this.editingUserId === user.id) {
          this.startCreate();
        }

        this.successMessage$.next(`Usuario ${user.fullName} removido com sucesso.`);
        this.refresh$.next();
      },
      error: (error) => {
        this.errorMessage$.next(error?.error?.message || 'Nao foi possivel remover usuario.');
      }
    });
  }

  protected resetTwoFactor(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: 'Resetar 2FA',
        message: `Resetar 2FA do usuario ${user.username}? Isso desativara 2FA, removera dispositivos confiaveis e backup codes.`,
        confirmText: 'Resetar 2FA'
      }
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
        }
      });
    });
  }

  protected onCompanySelected(companyId: number): void {
    this.form.controls.companyId.setValue(companyId);
    this.form.controls.companySearch.setValue(this.companyLabel(companyId), { emitEvent: false });
  }

  protected clearSelectedCompany(): void {
    this.form.controls.companyId.setValue(null);
    this.form.controls.companySearch.setValue('');
    this.applyCompanyFilter('');
  }

  protected isCreateMode(): boolean {
    return this.editingUserId === null;
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
    return company ? company.name : `#${companyId}`;
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

}
