import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';

import { UpdateUserPayload, User } from '../../core/models/user.model';
import { USER_ROLE_LABEL, type UserRole } from '../../core/models/user-role.model';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatToolbarModule
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  protected readonly authService = inject(AuthService);

  protected readonly displayedColumns: string[] = ['id', 'fullName', 'email', 'role', 'createdAt', 'actions'];
  protected readonly roleOptions: UserRole[] = ['ADMIN', 'USER'];
  protected users: User[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected editingUserId: number | null = null;

  protected readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(6)]],
    role: ['USER' as UserRole, [Validators.required]]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  protected get totalUsers(): number {
    return this.users.length;
  }

  protected loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService
      .listUsers()
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.users = Array.isArray(response?.users) ? response.users : [];
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'Não foi possível carregar os usuários.';
          this.users = [];
        }
      });
  }

  protected startCreate(): void {
    this.editingUserId = null;
    this.form.reset({ fullName: '', email: '', password: '', role: 'USER' });
  }

  protected startEdit(user: User): void {
    this.editingUserId = user.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.reset({
      fullName: user.fullName,
      email: user.email,
      password: '',
      role: user.role
    });
  }

  protected cancelEdit(): void {
    this.startCreate();
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email, password, role } = this.form.getRawValue();

    if (this.isCreateMode() && !password) {
      this.errorMessage = 'A senha é obrigatória para criar usuário.';
      return;
    }

    if (!role) {
      this.errorMessage = 'Selecione um perfil para o usuário.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isCreateMode()) {
      this.userService
        .createUser({ fullName: fullName!, email: email!, password: password!, role })
        .subscribe({
          next: ({ user }) => {
            this.isSaving = false;
            this.startCreate();
            this.successMessage = `Usuário ${user.fullName} criado com sucesso.`;
            this.loadUsers();
          },
          error: (error) => {
            this.isSaving = false;
            this.errorMessage = error?.error?.message || 'Não foi possível criar usuário.';
          }
        });

      return;
    }

    const payload: UpdateUserPayload = {
      fullName: fullName || undefined,
      email: email || undefined,
      role
    };

    if (password) {
      payload.password = password;
    }

    this.userService.updateUser(this.editingUserId!, payload).subscribe({
      next: ({ user }) => {
        this.isSaving = false;
        this.startCreate();
        this.successMessage = `Usuário ${user.fullName} atualizado com sucesso.`;
        this.loadUsers();
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error?.error?.message || 'Não foi possível atualizar usuário.';
      }
    });
  }

  protected removeUser(user: User): void {
    if (!confirm(`Deseja realmente excluir ${user.fullName}?`)) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        if (this.editingUserId === user.id) {
          this.startCreate();
        }

        this.successMessage = `Usuário ${user.fullName} removido com sucesso.`;
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Não foi possível remover usuário.';
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
  }

  protected isCreateMode(): boolean {
    return this.editingUserId === null;
  }

  protected roleLabel(role: UserRole): string {
    return USER_ROLE_LABEL[role];
  }
}
