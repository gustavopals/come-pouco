import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import {
  BehaviorSubject,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { COMPANY_ROLE_LABEL } from '../../core/models/company-role.model';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { LandingConfigService } from '../../core/services/landing-config.service';
import { LandingConfigResponse } from '../../core/models/landing-config.model';
import { UserService } from '../../core/services/user.service';
import {
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  ResponsiveTableComponent,
  SkeletonLoaderComponent,
  StatusChipComponent,
} from '../../shared/components';

type SlugAvailabilityState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'current'
  | 'invalid'
  | 'error';

@Component({
  selector: 'app-my-company',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTableModule,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    ResponsiveTableComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './my-company.component.html',
  styleUrl: './my-company.component.scss',
})
export class MyCompanyComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly landingConfigService = inject(LandingConfigService);
  private readonly userService = inject(UserService);
  private readonly refresh$ = new Subject<void>();

  private currentCompanyPublicSlug: string | null = null;
  protected readonly displayedColumns = [
    'id',
    'fullName',
    'email',
    'companyRole',
    'publicSlug',
    'createdAt',
  ];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly formErrorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly formSuccessMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly landingErrorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly landingSuccessMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly landingLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly slugAvailability$ = new BehaviorSubject<SlugAvailabilityState>('idle');
  protected landingCompanyName = '';
  protected landingUpdatedAt: string | null = null;
  protected isLandingSaving = false;
  protected editingEmployeeSlugId: number | null = null;
  protected employeeSlugDraft = '';
  protected employeeSlugSavingId: number | null = null;
  protected readonly landingForm = this.formBuilder.group({
    publicSlug: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(32),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    fallbackAffiliateUrl: ['', [Validators.required]],
    isActive: [false],
    bannerText: ['', [Validators.required, Validators.maxLength(160)]],
    bannerEmoji: ['', [Validators.required, Validators.maxLength(16)]],
    heroTitle: ['', [Validators.required, Validators.maxLength(160)]],
    heroSubtitle: ['', [Validators.required, Validators.maxLength(280)]],
    primaryColor: ['#10b981', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    logoUrl: [''],
    howItWorksSteps: this.formBuilder.array<FormControl<string>>([]),
  });

  protected readonly employees$ = this.refresh$.pipe(
    startWith(void 0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(() =>
      this.userService.listAllUsers().pipe(
        map((users) =>
          Array.isArray(users)
            ? users.filter((user) => user.role === 'USER' && user.companyRole === 'EMPLOYEE')
            : [],
        ),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar usuarios.');
          return of([] as User[]);
        }),
        finalize(() => this.isLoading$.next(false)),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  ngOnInit(): void {
    this.loadLandingConfig();
    this.watchPublicSlugAvailability();
  }

  protected loadEmployees(): void {
    this.refresh$.next();
  }

  protected loadLandingConfig(): void {
    const companyId = this.currentCompanyId();

    if (!companyId) {
      this.landingErrorMessage$.next('Empresa nao encontrada para o usuario atual.');
      return;
    }

    this.landingLoading$.next(true);
    this.landingErrorMessage$.next(null);

    this.landingConfigService
      .get(companyId)
      .pipe(finalize(() => this.landingLoading$.next(false)))
      .subscribe({
        next: (response) => {
          this.applyLandingConfigResponse(response);
          this.landingSuccessMessage$.next(null);
        },
        error: (error) => {
          this.landingErrorMessage$.next(
            error?.error?.message || 'Nao foi possivel carregar a landing publica.',
          );
        },
      });
  }

  protected get howItWorksSteps(): FormArray<FormControl<string>> {
    return this.landingForm.controls.howItWorksSteps;
  }

  protected addHowItWorksStep(): void {
    if (this.howItWorksSteps.length >= 4) {
      return;
    }

    this.howItWorksSteps.push(this.createStepControl(''));
  }

  protected removeHowItWorksStep(index: number): void {
    if (this.howItWorksSteps.length <= 1) {
      return;
    }

    this.howItWorksSteps.removeAt(index);
  }

  protected saveLandingConfig(): void {
    if (this.landingForm.invalid || this.isLandingSaving) {
      this.landingForm.markAllAsTouched();
      return;
    }

    const companyId = this.currentCompanyId();
    if (!companyId) {
      this.landingErrorMessage$.next('Empresa nao encontrada para salvar a landing.');
      return;
    }

    const raw = this.landingForm.getRawValue();
    const publicSlug = this.slugify(raw.publicSlug || '');
    const fallbackAffiliateUrl = (raw.fallbackAffiliateUrl || '').trim();
    const logoUrl = (raw.logoUrl || '').trim();
    const steps = raw.howItWorksSteps.map((step) => step.trim()).filter(Boolean);

    if (raw.isActive && (!publicSlug || !fallbackAffiliateUrl)) {
      this.landingSuccessMessage$.next(null);
      this.landingErrorMessage$.next('Informe slug publico e URL de fallback antes de ativar.');
      return;
    }

    this.isLandingSaving = true;
    this.landingErrorMessage$.next(null);
    this.landingSuccessMessage$.next(null);

    this.landingConfigService
      .updateCompanyPublicSlug(companyId, publicSlug || null)
      .pipe(
        switchMap(() =>
          this.landingConfigService.updateCompanyFallbackUrl(
            companyId,
            fallbackAffiliateUrl || null,
          ),
        ),
        switchMap(() =>
          this.landingConfigService.updateLandingConfig(companyId, {
            bannerText: raw.bannerText || '',
            bannerEmoji: raw.bannerEmoji || '',
            heroTitle: raw.heroTitle || '',
            heroSubtitle: raw.heroSubtitle || '',
            howItWorksSteps: steps,
            primaryColor: raw.primaryColor || '#10b981',
            logoUrl: logoUrl || null,
            isActive: Boolean(raw.isActive),
          }),
        ),
        finalize(() => {
          this.isLandingSaving = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.applyLandingConfigResponse(response);
          this.landingErrorMessage$.next(null);
          this.landingSuccessMessage$.next('Landing publica atualizada.');
        },
        error: (error) => {
          this.landingSuccessMessage$.next(null);
          this.landingErrorMessage$.next(
            error?.error?.message || 'Nao foi possivel salvar a landing publica.',
          );
        },
      });
  }

  protected previewUrl(): string {
    const slug = this.slugify(this.landingForm.controls.publicSlug.value || '');
    return slug ? `/p/${slug}?preview=true` : '/p/preview?preview=true';
  }

  protected startEmployeeSlugEdit(user: User): void {
    this.editingEmployeeSlugId = user.id;
    this.employeeSlugDraft = user.publicSlug || '';
  }

  protected cancelEmployeeSlugEdit(): void {
    this.editingEmployeeSlugId = null;
    this.employeeSlugDraft = '';
  }

  protected saveEmployeeSlug(user: User): void {
    if (this.employeeSlugSavingId) {
      return;
    }

    this.employeeSlugSavingId = user.id;
    this.formErrorMessage$.next(null);
    this.formSuccessMessage$.next(null);

    const publicSlug = this.slugify(this.employeeSlugDraft);
    this.landingConfigService
      .updateUserPublicSlug(user.id, publicSlug || null)
      .pipe(finalize(() => (this.employeeSlugSavingId = null)))
      .subscribe({
        next: () => {
          this.cancelEmployeeSlugEdit();
          this.formSuccessMessage$.next(`Slug publico de ${user.fullName} atualizado.`);
          this.refresh$.next();
        },
        error: (error) => {
          this.formErrorMessage$.next(
            error?.error?.message || 'Nao foi possivel atualizar o slug publico.',
          );
        },
      });
  }

  protected slugStatusLabel(status: SlugAvailabilityState | null): string {
    switch (status) {
      case 'checking':
        return 'Verificando...';
      case 'available':
        return 'Disponivel';
      case 'taken':
        return 'Em uso';
      case 'current':
        return 'Slug atual';
      case 'invalid':
        return 'Use 3-32 caracteres em kebab-case.';
      case 'error':
        return 'Nao foi possivel verificar agora.';
      default:
        return 'Digite um slug publico.';
    }
  }

  protected companyRoleLabel(user: User): string {
    if (!user.companyRole) {
      return '-';
    }

    return COMPANY_ROLE_LABEL[user.companyRole];
  }

  private currentCompanyId(): number | null {
    return this.authService.currentUser()?.companyId ?? null;
  }

  private watchPublicSlugAvailability(): void {
    this.landingForm.controls.publicSlug.valueChanges
      .pipe(
        debounceTime(300),
        map((value) => this.slugify(value || '')),
        distinctUntilChanged(),
        switchMap((slug) => {
          if (!slug || this.landingForm.controls.publicSlug.invalid) {
            return of('invalid' as SlugAvailabilityState);
          }

          if (slug === this.currentCompanyPublicSlug) {
            return of('current' as SlugAvailabilityState);
          }

          this.slugAvailability$.next('checking');
          return this.landingConfigService.isPublicSlugAvailable(slug).pipe(
            map((available) => (available ? 'available' : 'taken') as SlugAvailabilityState),
            catchError(() => of('error' as SlugAvailabilityState)),
          );
        }),
      )
      .subscribe((status) => this.slugAvailability$.next(status));
  }

  private applyLandingConfigResponse(response: LandingConfigResponse): void {
    this.landingCompanyName = response.company.name;
    this.currentCompanyPublicSlug = response.company.publicSlug;
    this.landingUpdatedAt = response.landingConfig.updatedAt;
    this.resetSteps(response.landingConfig.howItWorksSteps);
    this.landingForm.patchValue(
      {
        publicSlug: response.company.publicSlug || '',
        fallbackAffiliateUrl: response.company.fallbackAffiliateUrl || '',
        isActive: response.landingConfig.isActive,
        bannerText: response.landingConfig.bannerText,
        bannerEmoji: response.landingConfig.bannerEmoji,
        heroTitle: response.landingConfig.heroTitle,
        heroSubtitle: response.landingConfig.heroSubtitle,
        primaryColor: response.landingConfig.primaryColor,
        logoUrl: response.landingConfig.logoUrl || '',
      },
      { emitEvent: false },
    );
    this.slugAvailability$.next(response.company.publicSlug ? 'current' : 'idle');
  }

  private resetSteps(steps: string[]): void {
    this.howItWorksSteps.clear();
    const safeSteps = steps.length ? steps : ['Cole o link Shopee'];
    safeSteps
      .slice(0, 4)
      .forEach((step) => this.howItWorksSteps.push(this.createStepControl(step)));
  }

  private createStepControl(value: string): FormControl<string> {
    return this.formBuilder.control(value, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    });
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
}
