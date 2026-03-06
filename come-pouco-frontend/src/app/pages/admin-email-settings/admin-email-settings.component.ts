import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BehaviorSubject } from 'rxjs';

import { EmailProvider, SystemEmailConfig, UpdateSystemEmailConfigPayload } from '../../core/models/email-config.model';
import { AdminEmailConfigService } from '../../core/services/admin-email-config.service';

@Component({
  selector: 'app-admin-email-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  templateUrl: './admin-email-settings.component.html',
  styleUrl: './admin-email-settings.component.scss'
})
export class AdminEmailSettingsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminEmailConfigService = inject(AdminEmailConfigService);

  protected readonly providers: Array<{ value: EmailProvider; label: string }> = [
    { value: 'smtp', label: 'SMTP' },
    { value: 'resend', label: 'Resend' },
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'ses', label: 'Amazon SES' },
    { value: 'mailgun', label: 'Mailgun' }
  ];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly isSaving$ = new BehaviorSubject<boolean>(false);
  protected readonly isTesting$ = new BehaviorSubject<boolean>(false);
  protected readonly message$ = new BehaviorSubject<string>('');
  protected readonly error$ = new BehaviorSubject<string>('');

  protected readonly form = this.formBuilder.group({
    provider: ['smtp' as EmailProvider, [Validators.required]],
    fromEmail: ['', [Validators.required, Validators.email]],
    fromName: [''],
    enabled: [true],
    smtpHost: [''],
    smtpPort: [587],
    smtpUser: [''],
    smtpPassword: [''],
    smtpSecure: [false],
    resendApiKey: [''],
    sendgridApiKey: [''],
    sesAccessKey: [''],
    sesSecretKey: [''],
    sesRegion: [''],
    mailgunApiKey: [''],
    mailgunDomain: ['']
  });

  ngOnInit(): void {
    this.loadConfig();
  }

  protected get selectedProvider(): EmailProvider {
    return (this.form.controls.provider.value || 'smtp') as EmailProvider;
  }

  protected loadConfig(): void {
    this.isLoading$.next(true);
    this.error$.next('');

    this.adminEmailConfigService.getConfig().subscribe({
      next: ({ config }) => {
        this.isLoading$.next(false);
        this.patchConfig(config);
      },
      error: (error) => {
        this.isLoading$.next(false);
        this.error$.next(error?.error?.message || 'Nao foi possivel carregar a configuracao.');
      }
    });
  }

  protected save(): void {
    if (this.form.invalid || this.isSaving$.value) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving$.next(true);
    this.error$.next('');
    this.message$.next('');

    this.adminEmailConfigService.updateConfig(this.toPayload()).subscribe({
      next: ({ config }) => {
        this.isSaving$.next(false);
        this.patchConfig(config);
        this.message$.next('Configuracao salva com sucesso.');
      },
      error: (error) => {
        this.isSaving$.next(false);
        this.error$.next(error?.error?.message || 'Nao foi possivel salvar a configuracao.');
      }
    });
  }

  protected testSend(): void {
    if (this.isTesting$.value) {
      return;
    }

    this.isTesting$.next(true);
    this.error$.next('');
    this.message$.next('');

    this.adminEmailConfigService.testSend().subscribe({
      next: ({ message }) => {
        this.isTesting$.next(false);
        this.message$.next(message || 'E-mail de teste enviado.');
      },
      error: (error) => {
        this.isTesting$.next(false);
        this.error$.next(error?.error?.message || 'Falha no teste de envio.');
      }
    });
  }

  private patchConfig(config: SystemEmailConfig): void {
    this.form.patchValue({
      provider: config.provider,
      fromEmail: config.fromEmail,
      fromName: config.fromName || '',
      enabled: config.enabled,
      smtpHost: config.smtpHost || '',
      smtpPort: config.smtpPort ?? 587,
      smtpUser: config.smtpUser || '',
      smtpPassword: '',
      smtpSecure: Boolean(config.smtpSecure),
      resendApiKey: '',
      sendgridApiKey: '',
      sesAccessKey: '',
      sesSecretKey: '',
      sesRegion: config.sesRegion || '',
      mailgunApiKey: '',
      mailgunDomain: config.mailgunDomain || ''
    });
  }

  private toPayload(): UpdateSystemEmailConfigPayload {
    const value = this.form.getRawValue();
    return {
      provider: value.provider as EmailProvider,
      fromEmail: value.fromEmail || '',
      fromName: value.fromName || null,
      enabled: Boolean(value.enabled),
      smtpHost: value.smtpHost || null,
      smtpPort: value.smtpPort !== null && value.smtpPort !== undefined ? Number(value.smtpPort) : null,
      smtpUser: value.smtpUser || null,
      smtpPassword: value.smtpPassword || '',
      smtpSecure: Boolean(value.smtpSecure),
      resendApiKey: value.resendApiKey || '',
      sendgridApiKey: value.sendgridApiKey || '',
      sesAccessKey: value.sesAccessKey || '',
      sesSecretKey: value.sesSecretKey || '',
      sesRegion: value.sesRegion || null,
      mailgunApiKey: value.mailgunApiKey || '',
      mailgunDomain: value.mailgunDomain || null
    };
  }
}
