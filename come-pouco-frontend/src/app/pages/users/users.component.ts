import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UpdateUserPayload, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  protected readonly authService = inject(AuthService);

  protected users: User[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected editingUserId: number | null = null;

  protected readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(6)]]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  protected loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.listUsers().subscribe({
      next: ({ users }) => {
        this.users = users;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Não foi possível carregar os usuários.';
        this.isLoading = false;
      }
    });
  }

  protected startCreate(): void {
    this.editingUserId = null;
    this.form.reset({ fullName: '', email: '', password: '' });
  }

  protected startEdit(user: User): void {
    this.editingUserId = user.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.reset({
      fullName: user.fullName,
      email: user.email,
      password: ''
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

    const { fullName, email, password } = this.form.getRawValue();

    if (this.isCreateMode() && !password) {
      this.errorMessage = 'A senha é obrigatória para criar usuário.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isCreateMode()) {
      this.userService
        .createUser({ fullName: fullName!, email: email!, password: password! })
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
      email: email || undefined
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

  protected trackByUserId(_index: number, user: User): number {
    return user.id;
  }

  protected isCreateMode(): boolean {
    return this.editingUserId === null;
  }
}
