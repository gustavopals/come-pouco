import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = (this.route.snapshot.queryParamMap.get('token') || '').trim();
  protected readonly isSubmitting$ = new BehaviorSubject<boolean>(false);
  protected readonly message$ = new BehaviorSubject<string>('');
  protected readonly error$ = new BehaviorSubject<string>('');

  protected readonly form = this.formBuilder.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

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
      }
    });
  }
}
