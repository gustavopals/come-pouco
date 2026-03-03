import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Subject, catchError, finalize, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { COMPANY_ROLE_LABEL } from '../../core/models/company-role.model';
import { User } from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-my-company',
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
    MatProgressBarModule,
    MatTableModule
  ],
  templateUrl: './my-company.component.html'
})
export class MyCompanyComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly refresh$ = new Subject<void>();

  protected readonly displayedColumns = ['id', 'fullName', 'email', 'companyRole', 'createdAt'];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly formErrorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly formSuccessMessage$ = new BehaviorSubject<string | null>(null);
  protected isSubmitting = false;
  protected readonly employeeForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  protected readonly employees$ = this.refresh$.pipe(
    startWith(void 0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(() =>
      this.userService.listUsers().pipe(
        map(({ users }) => (Array.isArray(users) ? users.filter((user) => user.role === 'USER') : [])),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar usuarios.');
          return of([] as User[]);
        }),
        finalize(() => this.isLoading$.next(false))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnInit(): void {}

  protected loadEmployees(): void {
    this.refresh$.next();
  }

  protected createEmployee(): void {
    if (this.employeeForm.invalid || this.isSubmitting) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const { fullName, username, email, password, confirmPassword } = this.employeeForm.getRawValue();

    if (password !== confirmPassword) {
      this.formSuccessMessage$.next(null);
      this.formErrorMessage$.next('As senhas nao conferem.');
      return;
    }

    this.isSubmitting = true;
    this.formSuccessMessage$.next(null);
    this.formErrorMessage$.next(null);

    this.userService
      .createEmployee({
        fullName: fullName!,
        username: username!,
        email: (email || '').trim().toLowerCase() || undefined,
        password: password!
      })
      .subscribe({
        next: ({ user }) => {
          this.isSubmitting = false;
          this.employeeForm.reset({
            fullName: '',
            username: '',
            email: '',
            password: '',
            confirmPassword: ''
          });
          this.formErrorMessage$.next(null);
          this.formSuccessMessage$.next(`Funcionario ${user.fullName} criado com sucesso.`);
          this.refresh$.next();
        },
        error: (error) => {
          this.isSubmitting = false;
          this.formSuccessMessage$.next(null);
          this.formErrorMessage$.next(error?.error?.message || 'Nao foi possivel criar funcionario.');
        }
      });
  }

  protected companyRoleLabel(user: User): string {
    if (!user.companyRole) {
      return '-';
    }

    return COMPANY_ROLE_LABEL[user.companyRole];
  }
}
