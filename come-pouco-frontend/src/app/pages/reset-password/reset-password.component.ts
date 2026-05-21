import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import {
  getStrongPasswordErrorMessage,
  strongPasswordValidator,
} from '../../shared/validators/strong-password.validator';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    AuthShellComponent,
    IconComponent,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = (this.route.snapshot.queryParamMap.get('token') || '').trim();
  protected readonly isSubmitting$ = new BehaviorSubject<boolean>(false);
  protected readonly message$ = new BehaviorSubject<string>('');
  protected readonly error$ = new BehaviorSubject<string>('');
  protected readonly hidePassword = signal(true);

  protected readonly form = this.formBuilder.group({
    newPassword: ['', [Validators.required, strongPasswordValidator]],
  });

  protected togglePasswordVisibility(): void {
    this.hidePassword.update((hidden) => !hidden);
  }

  protected passwordValue(): string {
    return this.form.controls.newPassword.value || '';
  }

  protected hasMinLength(): boolean {
    return this.passwordValue().length >= 10;
  }

  protected hasLetter(): boolean {
    return /[A-Za-z]/.test(this.passwordValue());
  }

  protected hasNumber(): boolean {
    return /\d/.test(this.passwordValue());
  }

  protected hasNoSpaces(): boolean {
    return this.passwordValue().length > 0 && !/\s/.test(this.passwordValue());
  }

  protected hasNoObviousPattern(): boolean {
    const value = this.passwordValue();
    const normalized = value.toLowerCase();
    return (
      value.length > 0 &&
      !/(.)\1{2,}/.test(value) &&
      !['123456', 'abcdef', 'qwerty', 'password', 'senha'].some((pattern) =>
        normalized.includes(pattern),
      )
    );
  }

  protected passwordScore(): number {
    return [
      this.hasMinLength(),
      this.hasLetter(),
      this.hasNumber(),
      this.hasNoSpaces(),
      this.hasNoObviousPattern(),
    ].filter(Boolean).length;
  }

  protected passwordStrengthLabel(): string {
    const score = this.passwordScore();

    if (score >= 4) {
      return 'Forte';
    }

    if (score >= 3) {
      return 'Boa';
    }

    if (score >= 2) {
      return 'Media';
    }

    return 'Fraca';
  }

  protected passwordStrengthClass(): string {
    const score = this.passwordScore();

    if (score >= 4) {
      return 'strength-strong';
    }

    if (score >= 3) {
      return 'strength-good';
    }

    if (score >= 2) {
      return 'strength-medium';
    }

    return 'strength-weak';
  }

  protected passwordStrengthWidth(): string {
    return `${Math.max(this.passwordScore(), 1) * 20}%`;
  }

  protected passwordErrorMessage(): string {
    return getStrongPasswordErrorMessage(this.form.controls.newPassword);
  }

  protected submit(): void {
    if (!this.token.length) {
      this.error$.next('Token ausente ou invalido.');
      return;
    }

    if (this.form.invalid || this.isSubmitting$.value) {
      this.form.markAllAsTouched();
      return;
    }

    const newPassword = this.form.controls.newPassword.value || '';
    this.isSubmitting$.next(true);
    this.error$.next('');
    this.message$.next('');

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: ({ message }) => {
        this.isSubmitting$.next(false);
        this.message$.next(message || 'Senha redefinida com sucesso.');
      },
      error: (error) => {
        this.isSubmitting$.next(false);
        this.error$.next(error?.error?.message || 'Nao foi possivel redefinir a senha.');
      },
    });
  }
}
