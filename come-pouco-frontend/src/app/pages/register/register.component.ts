import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/services/auth.service';
import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import {
  getStrongPasswordErrorMessage,
  strongPasswordValidator,
} from '../../shared/validators/strong-password.validator';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);

  protected readonly registerForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, strongPasswordValidator]],
    confirmPassword: ['', [Validators.required]],
  });

  protected togglePasswordVisibility(): void {
    this.hidePassword.update((hidden) => !hidden);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.update((hidden) => !hidden);
  }

  protected passwordsMismatch(): boolean {
    const password = this.registerForm.controls.password.value || '';
    const confirmPassword = this.registerForm.controls.confirmPassword.value || '';

    return Boolean(confirmPassword.length && password !== confirmPassword);
  }

  protected passwordErrorMessage(): string {
    return getStrongPasswordErrorMessage(this.registerForm.controls.password);
  }

  protected submit(): void {
    if (this.registerForm.invalid || this.isSubmitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { fullName, username, email, password, confirmPassword } =
      this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      this.errorMessage.set('As senhas nao conferem.');
      this.registerForm.controls.confirmPassword.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService
      .register({
        fullName: fullName!,
        username: username!,
        email: email || undefined,
        password: password!,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          void this.router.navigate(['/home']);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(error?.error?.message || 'Nao foi possivel criar a conta.');
        },
      });
  }
}
