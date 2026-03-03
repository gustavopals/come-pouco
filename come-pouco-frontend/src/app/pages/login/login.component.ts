import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

import { ApiErrorResponse } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly isSubmitting$ = new BehaviorSubject<boolean>(false);
  private readonly errorMessage$ = new BehaviorSubject<string>('');
  private readonly tempToken$ = new BehaviorSubject<string | null>(null);

  protected readonly vm$ = combineLatest([this.isSubmitting$, this.errorMessage$, this.tempToken$]).pipe(
    map(([isSubmitting, errorMessage, tempToken]) => ({ isSubmitting, errorMessage, tempToken }))
  );

  protected readonly loginForm = this.formBuilder.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  protected readonly twoFactorForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
    trustDevice: [false]
  });

  protected submit(vm: { tempToken: string | null; isSubmitting: boolean }): void {
    if (vm.tempToken) {
      this.submitTwoFactor(vm);
      return;
    }

    if (this.loginForm.invalid || vm.isSubmitting) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting$.next(true);
    this.errorMessage$.next('');

    const { identifier, password } = this.loginForm.getRawValue();

    this.authService.login(identifier!, password!).subscribe({
      next: (response) => {
        this.isSubmitting$.next(false);

        if (!('token' in response) || !('user' in response)) {
          const tempToken = response.tempToken || response.challengeId || null;

          if (!tempToken) {
            this.errorMessage$.next('Falha ao iniciar desafio 2FA.');
            return;
          }

          this.tempToken$.next(tempToken);
          this.twoFactorForm.reset({ code: '', trustDevice: false });
          return;
        }

        this.authService.completeLogin(response);
        void this.router.navigate(['/home']);
      },
      error: (error) => {
        this.isSubmitting$.next(false);
        this.errorMessage$.next(this.resolveErrorMessage(error?.error));
      }
    });
  }

  protected backToLogin(): void {
    this.tempToken$.next(null);
    this.twoFactorForm.reset({ code: '', trustDevice: false });
    this.errorMessage$.next('');
  }

  private submitTwoFactor(vm: { tempToken: string | null; isSubmitting: boolean }): void {
    if (!vm.tempToken) {
      return;
    }

    if (this.twoFactorForm.invalid || vm.isSubmitting) {
      this.twoFactorForm.markAllAsTouched();
      return;
    }

    this.isSubmitting$.next(true);
    this.errorMessage$.next('');

    const { code, trustDevice } = this.twoFactorForm.getRawValue();

    this.authService
      .loginTwoFactor({
        tempToken: vm.tempToken,
        code: code!,
        trustDevice: Boolean(trustDevice)
      })
      .subscribe({
        next: () => {
          this.isSubmitting$.next(false);
          void this.router.navigate(['/home']);
        },
        error: (error) => {
          this.isSubmitting$.next(false);
          this.errorMessage$.next(this.resolveErrorMessage(error?.error));
        }
      });
  }

  private resolveErrorMessage(errorPayload: ApiErrorResponse | undefined): string {
    const code = errorPayload?.errorCode;

    if (code === 'AUTH_INVALID_CREDENTIALS') {
      return 'Usuario/e-mail ou senha invalidos.';
    }

    if (code === 'AUTH_INVALID_2FA_CODE') {
      return 'Codigo 2FA invalido.';
    }

    if (code === 'AUTH_2FA_STATE_INVALID') {
      return 'Configuracao de 2FA invalida. Reconfigure na tela de seguranca.';
    }

    if (code === 'AUTH_SCHEMA_OUTDATED') {
      return 'Ambiente desatualizado. Execute migracoes do banco.';
    }

    return errorPayload?.message || 'Nao foi possivel fazer login.';
  }
}