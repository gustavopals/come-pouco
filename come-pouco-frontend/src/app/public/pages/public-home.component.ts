import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { Subscription, interval, map, take } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PublicConvertResponse, PublicLandingResponse } from '../models/public-landing.model';
import { PublicAnalyticsService, PublicRedirectSource } from '../services/public-analytics.service';
import { PublicConvertService } from '../services/public-convert.service';
import { PublicRedirectService } from '../services/public-redirect.service';
import { isLikelyShopeeUrl, shopeeUrlValidator } from '../utils/shopee-url.validator';

type ConversionStatusTone = 'info' | 'success' | 'error';
type ConversionState = 'form' | 'loading' | 'success' | 'fallback' | 'error';

interface ResultCopy {
  eyebrow: string;
  title: string;
  message: string;
  mark: string;
}

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatProgressSpinnerModule],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.scss',
})
export class PublicHomeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly publicConvertService = inject(PublicConvertService);
  private readonly publicAnalyticsService = inject(PublicAnalyticsService);
  private readonly publicRedirectService = inject(PublicRedirectService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('submitButton')
  private submitButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('urlInput')
  private urlInput?: ElementRef<HTMLInputElement>;

  private readonly redirectDelaySeconds = 2;
  private redirectCountdownSubscription?: Subscription;

  protected readonly convertForm = this.formBuilder.nonNullable.group({
    url: ['', [Validators.required, shopeeUrlValidator]],
    website: [''],
  });

  protected readonly landing = toSignal(
    this.route.parent!.data.pipe(map((data) => data['landing'] as PublicLandingResponse)),
    { initialValue: null },
  );
  protected readonly employeeSlug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('employeeSlug'))),
    {
      initialValue: null,
    },
  );
  protected readonly isPreview = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('preview') === 'true')),
    { initialValue: false },
  );
  protected readonly steps = computed(() => this.landing()?.landingConfig.howItWorksSteps ?? []);

  protected readonly conversionState = signal<ConversionState>('form');
  protected readonly isSubmitting = computed(() => this.conversionState() === 'loading');
  protected readonly shouldShowForm = computed(
    () => this.conversionState() === 'form' || this.conversionState() === 'loading',
  );
  protected readonly isRedirectState = computed(
    () => this.conversionState() === 'success' || this.conversionState() === 'fallback',
  );
  protected readonly countdownSeconds = signal(this.redirectDelaySeconds);
  protected readonly redirectUrl = signal<string | null>(null);
  protected readonly activeConversionId = signal<string | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly statusTone = signal<ConversionStatusTone>('info');
  protected readonly resultCopy = computed<ResultCopy>(() => {
    const countdownSeconds = this.countdownSeconds();

    switch (this.conversionState()) {
      case 'success':
        return {
          eyebrow: 'Cupom aplicado',
          title: 'Cupom aplicado!',
          message: `Abrindo a Shopee em uma nova aba em ${countdownSeconds}s.`,
          mark: 'OK',
        };
      case 'fallback':
        return {
          eyebrow: 'Link pronto',
          title: 'Abrindo a Shopee em nova aba...',
          message: `A melhor rota disponivel esta pronta. Abrindo em ${countdownSeconds}s.`,
          mark: 'OK',
        };
      case 'error':
        return {
          eyebrow: 'Falha na conversao',
          title: 'Algo deu errado',
          message: 'Tente novamente com outro link da Shopee.',
          mark: '!',
        };
      default:
        return {
          eyebrow: 'Aplicando cupom',
          title: 'Buscando melhores cupons...',
          message: 'Estamos preparando seu link.',
          mark: '',
        };
    }
  });

  constructor() {
    this.ensurePublicApiPreconnect();
    this.destroyRef.onDestroy(() => this.cancelRedirectCountdown());
  }

  protected get urlControl() {
    return this.convertForm.controls.url;
  }

  protected submitConversion(): void {
    if (this.conversionState() === 'loading') {
      return;
    }

    this.cancelRedirectCountdown();
    this.conversionState.set('form');
    this.statusMessage.set(null);
    this.redirectUrl.set(null);
    this.activeConversionId.set(null);

    if (this.convertForm.controls.website.value.trim()) {
      return;
    }

    if (this.convertForm.invalid) {
      this.convertForm.markAllAsTouched();
      this.statusTone.set('error');
      this.statusMessage.set(this.urlErrorMessage() || 'Confira o link informado.');
      return;
    }

    const landing = this.landing();
    const url = this.urlControl.value.trim();

    if (!landing) {
      this.statusTone.set('error');
      this.statusMessage.set(
        'Nao foi possivel carregar a landing. Atualize a pagina e tente novamente.',
      );
      return;
    }

    this.conversionState.set('loading');
    this.statusTone.set('info');
    this.statusMessage.set('Buscando melhores cupons...');

    this.publicConvertService
      .convert({
        url,
        companySlug: landing.company.publicSlug,
        employeeSlug: this.employeeSlug() || undefined,
        website: this.convertForm.controls.website.value,
        honeypot: '',
      })
      .subscribe({
        next: (response) => this.handleConversionResponse(response),
        error: () => this.showErrorResult(),
      });
  }

  protected handlePaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text')?.trim();

    if (!pastedText || !isLikelyShopeeUrl(pastedText)) {
      return;
    }

    event.preventDefault();
    this.urlControl.setValue(pastedText);
    this.urlControl.markAsDirty();
    this.urlControl.markAsTouched();
    this.urlControl.updateValueAndValidity();
    this.statusMessage.set(null);

    queueMicrotask(() => this.submitButton?.nativeElement.focus());
  }

  protected goToShopeeNow(event?: Event): void {
    event?.preventDefault();
    this.redirectToShopee('manual');
  }

  protected retryConversion(): void {
    this.cancelRedirectCountdown();
    this.conversionState.set('form');
    this.statusTone.set('info');
    this.statusMessage.set(null);
    this.redirectUrl.set(null);
    this.activeConversionId.set(null);
    this.convertForm.reset({ url: '', website: '' });
    this.convertForm.markAsPristine();
    this.convertForm.markAsUntouched();

    queueMicrotask(() => this.urlInput?.nativeElement.focus());
  }

  protected urlErrorMessage(): string | null {
    if (!this.urlControl.touched && !this.urlControl.dirty) {
      return null;
    }

    if (this.urlControl.hasError('required')) {
      return 'Informe o link da Shopee.';
    }

    if (this.urlControl.hasError('shopeeUrl')) {
      return 'Use um link valido da Shopee.';
    }

    return null;
  }

  private handleConversionResponse(response: PublicConvertResponse): void {
    if (
      (response.status === 'success' || response.status === 'fallback') &&
      response.affiliateUrl
    ) {
      this.redirectUrl.set(response.affiliateUrl);
      this.activeConversionId.set(response.conversionId ?? null);
      this.conversionState.set(response.status);
      this.statusTone.set('success');
      this.statusMessage.set(
        response.status === 'fallback'
          ? 'Link alternativo pronto para continuar na Shopee.'
          : 'Link Shopee pronto para abrir em nova aba.',
      );
      this.trackConversionView(response.status, response.conversionId);
      this.startRedirectCountdown();
      return;
    }

    this.showErrorResult(response.errorCode, response.conversionId);
  }

  private showErrorResult(errorCode?: string, conversionId?: string): void {
    this.cancelRedirectCountdown();
    this.redirectUrl.set(null);
    this.activeConversionId.set(conversionId ?? null);
    this.conversionState.set('error');
    this.statusTone.set('error');
    this.statusMessage.set('Nao conseguimos preparar esse link. Tente outro link da Shopee.');
    this.trackConversionView('error', conversionId, errorCode);
  }

  private startRedirectCountdown(): void {
    this.cancelRedirectCountdown();
    this.countdownSeconds.set(this.redirectDelaySeconds);

    this.redirectCountdownSubscription = interval(1000)
      .pipe(take(this.redirectDelaySeconds), takeUntilDestroyed(this.destroyRef))
      .subscribe((tick) => {
        const nextSeconds = Math.max(this.redirectDelaySeconds - tick - 1, 0);
        this.countdownSeconds.set(nextSeconds);

        if (nextSeconds === 0) {
          this.redirectToShopee('auto');
        }
      });
  }

  private redirectToShopee(source: PublicRedirectSource): void {
    const url = this.redirectUrl();
    const status = this.conversionState();
    const landing = this.landing();

    if (!url || (status !== 'success' && status !== 'fallback')) {
      return;
    }

    this.cancelRedirectCountdown();

    if (landing) {
      this.publicAnalyticsService.trackRedirectClick({
        status,
        source,
        companySlug: landing.company.publicSlug,
        employeeSlug: this.employeeSlug(),
        conversionId: this.activeConversionId() ?? undefined,
      });
    }

    this.publicRedirectService.openInNewTab(url);
  }

  private cancelRedirectCountdown(): void {
    this.redirectCountdownSubscription?.unsubscribe();
    this.redirectCountdownSubscription = undefined;
  }

  private trackConversionView(
    status: 'success' | 'fallback' | 'error',
    conversionId?: string,
    errorCode?: string,
  ): void {
    const landing = this.landing();

    if (!landing) {
      return;
    }

    this.publicAnalyticsService.trackConversionView({
      status,
      companySlug: landing.company.publicSlug,
      employeeSlug: this.employeeSlug(),
      conversionId,
      errorCode,
    });
  }

  private ensurePublicApiPreconnect(): void {
    let apiUrl: URL;
    try {
      apiUrl = new URL(environment.apiUrl, this.document.location.origin);
    } catch {
      return;
    }

    if (apiUrl.origin === this.document.location.origin) {
      return;
    }

    this.appendApiHint('preconnect', apiUrl.origin);
    this.appendApiHint('dns-prefetch', apiUrl.origin);
  }

  private appendApiHint(rel: 'dns-prefetch' | 'preconnect', href: string): void {
    const exists = Array.from(
      this.document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`),
    ).some((link) => link.href === `${href}/`);

    if (exists) {
      return;
    }

    const link = this.document.createElement('link');
    link.rel = rel;
    link.href = href;

    if (rel === 'preconnect') {
      link.crossOrigin = 'anonymous';
    }

    this.document.head.appendChild(link);
  }
}
