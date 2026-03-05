import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly isSubmitting$ = new BehaviorSubject<boolean>(false);
  protected readonly message$ = new BehaviorSubject<string>('');
  protected readonly error$ = new BehaviorSubject<string>('');

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting$.value) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting$.next(true);
    this.error$.next('');
    this.message$.next('');

    const email = (this.form.controls.email.value || '').trim().toLowerCase();

    this.authService.forgotPassword(email).subscribe({
      next: ({ message }) => {
        this.isSubmitting$.next(false);
        this.message$.next(message || 'Se o e-mail estiver cadastrado, enviaremos instrucoes.');
      },
      error: (error) => {
        this.isSubmitting$.next(false);
        this.error$.next(error?.error?.message || 'Nao foi possivel processar a solicitacao.');
      }
    });
  }
}
