import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BehaviorSubject, Subject, catchError, finalize, map, merge, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import type { ApiErrorResponse, TrustedDevice, TwoFactorSetupResponse } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

interface ParsedOtpAuthMetadata {
  issuer: string;
  account: string;
}

@Component({
  selector: 'app-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss'
})
export class SecurityComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly refresh$ = new Subject<void>();
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly error$ = new BehaviorSubject<string | null>(null);
  private readonly setupRefresh$ = new Subject<void>();
  private readonly clearSetup$ = new Subject<void>();
  protected readonly setupLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly setupError$ = new BehaviorSubject<string | null>(null);

  protected isLoading = false;
  protected errorMessage = '';
  protected successMessage = '';

  protected backupCodes: string[] = [];
  protected readonly setup2fa$ = merge(
    this.setupRefresh$.pipe(
      tap(() => {
        this.resetMessages();
        this.setupLoading$.next(true);
        this.setupError$.next(null);
      }),
      switchMap(() =>
        this.authService.setupTwoFactor().pipe(
          catchError((error) => {
            this.setupError$.next(this.resolveErrorMessage(error?.error, 'Nao foi possivel iniciar o setup do 2FA.'));
            return of(null);
          }),
          finalize(() => this.setupLoading$.next(false))
        )
      )
    ),
    this.clearSetup$.pipe(map(() => null))
  ).pipe(startWith(null), shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly devices$ = this.refresh$.pipe(
    tap(() => {
      this.isLoading$.next(true);
      this.error$.next(null);
    }),
    switchMap(() =>
      this.authService.listTrustedDevices().pipe(
        map(({ devices }) => (Array.isArray(devices) ? devices : [])),
        catchError(() => {
          this.error$.next('Nao foi possivel carregar dispositivos confiaveis');
          return of([] as TrustedDevice[]);
        }),
        finalize(() => this.isLoading$.next(false))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  protected readonly devicesCount$ = this.devices$.pipe(map((list) => list?.length ?? 0));

  protected readonly confirmForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected readonly disableForm = this.formBuilder.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    code: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit(): void {
    this.refresh$.next();
  }

  protected startSetup(): void {
    this.backupCodes = [];
    this.setupRefresh$.next();
  }

  protected confirmSetup(): void {
    if (this.confirmForm.invalid || this.isLoading) {
      this.confirmForm.markAllAsTouched();
      return;
    }

    this.resetMessages();
    this.isLoading = true;

    this.authService.confirmTwoFactor(this.confirmForm.controls.code.value || '').subscribe({
      next: ({ backupCodes }) => {
        this.isLoading = false;
        this.successMessage = '2FA habilitado com sucesso. Salve os codigos de backup agora.';
        this.backupCodes = backupCodes;
        this.clearSetup$.next();
        this.confirmForm.reset({ code: '' });
        this.loadSessionAndDevices();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = this.resolveErrorMessage(error?.error, 'Nao foi possivel confirmar o 2FA.');
      }
    });
  }

  protected disableTwoFactor(): void {
    if (this.disableForm.invalid || this.isLoading) {
      this.disableForm.markAllAsTouched();
      return;
    }

    this.resetMessages();
    this.isLoading = true;

    const { password, code } = this.disableForm.getRawValue();

    this.authService.disableTwoFactor(password || '', code || '').subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = '2FA desativado com sucesso.';
        this.clearSetup$.next();
        this.backupCodes = [];
        this.disableForm.reset({ password: '', code: '' });
        this.loadSessionAndDevices();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = this.resolveErrorMessage(error?.error, 'Nao foi possivel desativar o 2FA.');
      }
    });
  }

  protected revokeDevice(deviceId: number): void {
    if (!confirm('Revogar este dispositivo confiavel?')) {
      return;
    }

    this.resetMessages();

    this.authService.revokeTrustedDevice(deviceId).subscribe({
      next: () => {
        this.successMessage = 'Dispositivo revogado com sucesso.';
        this.refreshDevices();
      },
      error: (error) => {
        this.errorMessage = this.resolveErrorMessage(error?.error, 'Nao foi possivel revogar o dispositivo.');
      }
    });
  }

  protected parseOtpAuthMetadata(otpauthUrl: string): ParsedOtpAuthMetadata | null {
    if (!otpauthUrl || !otpauthUrl.trim().length) {
      return null;
    }

    try {
      const parsed = new URL(otpauthUrl);

      if (parsed.protocol !== 'otpauth:') {
        return null;
      }

      const rawLabel = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      const labelParts = rawLabel.split(':');
      const issuer = (parsed.searchParams.get('issuer') || labelParts[0] || 'Come Pouco').trim();
      const account = (labelParts.slice(1).join(':') || rawLabel).trim();

      return {
        issuer,
        account
      };
    } catch {
      return null;
    }
  }

  protected getSecretForCopy(setup: TwoFactorSetupResponse): string {
    return setup.secretMasked.replace(/\s+/g, '');
  }

  protected copyManualValue(value: string, successMessage: string): void {
    if (!value.trim().length) {
      return;
    }

    this.copyTextToClipboard(value)
      .then((copied) => {
        if (!copied) {
          this.errorMessage = 'Nao foi possivel copiar.';
          return;
        }

        this.successMessage = successMessage;
      })
      .catch(() => {
        this.errorMessage = 'Nao foi possivel copiar.';
      });
  }

  protected refreshDevices(): void {
    this.refresh$.next();
  }

  private loadSessionAndDevices(): void {
    this.authService.me().subscribe({
      next: () => this.refreshDevices(),
      error: () => this.refreshDevices()
    });
  }

  private resetMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private copyTextToClipboard(value: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard
        .writeText(value)
        .then(() => true)
        .catch(() => this.copyTextWithFallback(value));
    }

    return Promise.resolve(this.copyTextWithFallback(value));
  }

  private copyTextWithFallback(value: string): boolean {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.select();

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    document.body.removeChild(textArea);
    return copied;
  }

  private resolveErrorMessage(errorPayload: ApiErrorResponse | undefined, fallback: string): string {
    const code = errorPayload?.errorCode;

    if (code === 'AUTH_INVALID_2FA_CODE') {
      return 'Codigo 2FA invalido.';
    }

    if (code === 'AUTH_INVALID_PASSWORD') {
      return 'Senha invalida.';
    }

    if (code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_TOKEN_INVALID') {
      return 'Sua sessao expirou. Faca login novamente.';
    }

    return errorPayload?.message || fallback;
  }
}
