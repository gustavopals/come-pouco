import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Subject, catchError, combineLatest, finalize, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { AffiliateLinksResultsDialogComponent } from './affiliate-links-results-dialog.component';
import {
  AffiliateLink,
  ShopeeShortLinkResult
} from '../../core/models/affiliate-link.model';
import { PurchasePlatform } from '../../core/models/purchase-platform.model';
import { User } from '../../core/models/user.model';
import { AffiliateLinkService } from '../../core/services/affiliate-link.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';
import { UserService } from '../../core/services/user.service';

export type LinkProcessResult = {
  originUrl: string;
  status: 'saved' | 'error';
  shortLink?: string;
  message: string;
};

type EmployeeOption = {
  id: number;
  label: string;
  email: string | null;
};

const MAX_LINKS_PER_BATCH = 5;

@Component({
  selector: 'app-affiliate-links',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './affiliate-links.component.html',
  styleUrl: './affiliate-links.component.scss'
})
export class AffiliateLinksComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly affiliateLinkService = inject(AffiliateLinkService);
  private readonly purchasePlatformService = inject(PurchasePlatformService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly authService = inject(AuthService);

  private readonly refresh$ = new Subject<void>();

  protected readonly displayedColumnsWithCreator: string[] = [
    'id',
    'createdBy',
    'originalLink',
    'affiliateLink',
    'updatedAt',
    'actions'
  ];
  protected readonly displayedColumnsDefault: string[] = [
    'id',
    'originalLink',
    'affiliateLink',
    'updatedAt',
    'actions'
  ];

  protected readonly processingResults$ = new BehaviorSubject<LinkProcessResult[]>([]);
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly isSaving$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly successMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly normalizedLinks$ = new BehaviorSubject<string[]>([]);
  protected adminShopeePlatforms: PurchasePlatform[] = [];

  protected readonly links$ = this.refresh$.pipe(
    startWith(void 0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(() =>
      this.affiliateLinkService.list().pipe(
        map((response) => (Array.isArray(response?.links) ? response.links : [])),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar os links.');
          return of([] as AffiliateLink[]);
        }),
        finalize(() => this.isLoading$.next(false))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  protected readonly totalLinks$ = this.links$.pipe(map((links) => links.length));
  protected readonly filtersForm = this.formBuilder.group({
    dateRange: this.formBuilder.group({
      start: [this.getTodayStart()],
      end: [this.getTodayEnd()]
    }),
    employeeId: [null as number | null]
  });
  protected readonly employees$ = (this.authService.isOwner()
    ? this.userService.listUsers().pipe(
        map(({ users }) => this.toEmployeeOptions(users)),
        catchError(() => of([] as EmployeeOption[]))
      )
    : of([] as EmployeeOption[])
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  protected readonly filteredLinks$ = combineLatest([
    this.links$,
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    this.employees$
  ]).pipe(
    map(([links, filters, employees]) => this.applyHistoryFilters(links, filters, employees))
  );
  protected readonly filteredTotalLinks$ = this.filteredLinks$.pipe(map((links) => links.length));
  protected readonly hasGeneratedShortLinks$ = this.processingResults$.pipe(
    map((results) => results.some((item) => typeof item.shortLink === 'string' && item.shortLink.trim().length > 0))
  );
  protected readonly maxLinksPerBatch = MAX_LINKS_PER_BATCH;

  protected readonly form = this.formBuilder.group({
    originalLinksText: ['', [Validators.required, this.originalLinksValidator.bind(this)]],
    subId1: ['', [Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    platformId: [null as number | null],
    useAutoSubId1: [false]
  });
  protected readonly linksCount$ = this.normalizedLinks$.pipe(
    map((links) => links.length),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  protected readonly isLinksOverLimit$ = this.linksCount$.pipe(map(() => false));

  ngOnInit(): void {
    this.authService.me().subscribe({
      next: () => {
        this.syncAutoSubId1WithCurrentUser();
        this.loadAdminPlatforms();
      },
      error: () => {
        this.errorMessage$.next('Nao foi possivel atualizar o contexto da empresa.');
        this.loadAdminPlatforms();
      }
    });

    this.form.controls.useAutoSubId1.valueChanges.subscribe((value) => {
      if (value) {
        this.syncAutoSubId1WithCurrentUser();
        this.form.controls.subId1.disable();
        return;
      }

      this.form.controls.subId1.enable();
      this.form.controls.subId1.setValue('');
    });

    this.form.controls.originalLinksText.valueChanges.subscribe((value) => this.applyOriginalLinksInput(value || ''));

    this.syncAutoSubId1WithCurrentUser();
    this.loadAdminPlatforms();
    this.startCreate();
    this.applyOriginalLinksInput(this.form.controls.originalLinksText.value || '');
  }

  protected get displayedColumns(): string[] {
    return this.authService.isOwner() ? this.displayedColumnsWithCreator : this.displayedColumnsDefault;
  }

  protected loadLinks(): void {
    this.refresh$.next();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({
      dateRange: {
        start: null,
        end: null
      },
      employeeId: null
    });
  }

  protected setTodayDateRange(): void {
    this.filtersForm.controls.dateRange.patchValue({
      start: this.getTodayStart(),
      end: this.getTodayEnd()
    });
  }

  protected isTodayDateRangeSelected(): boolean {
    const start = this.filtersForm.controls.dateRange.controls.start.value;
    const end = this.filtersForm.controls.dateRange.controls.end.value;

    if (!start || !end) {
      return false;
    }

    return this.startOfDay(start)?.getTime() === this.getTodayStart().getTime() && this.endOfDay(end)?.getTime() === this.getTodayEnd().getTime();
  }

  protected startCreate(): void {
    this.processingResults$.next([]);
    this.errorMessage$.next(null);
    this.successMessage$.next(null);
    this.form.reset({
      originalLinksText: '',
      subId1: '',
      platformId: this.getDefaultAdminPlatformId(),
      useAutoSubId1: false
    });
    this.form.controls.subId1.enable();
    this.normalizedLinks$.next([]);
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving$.getValue()) {
      this.form.markAllAsTouched();
      return;
    }

    const { originalLinksText, useAutoSubId1 } = this.form.getRawValue();
    this.applyOriginalLinksInput(originalLinksText ?? '');
    const originalLinks = this.normalizedLinks$.getValue();

    if (!originalLinks.length || originalLinks.length > MAX_LINKS_PER_BATCH) {
      this.form.controls.originalLinksText.markAsTouched();
      return;
    }

    const subIdValue = useAutoSubId1
      ? this.getUsernameFromEmail(this.authService.currentUser()?.username || this.authService.currentUser()?.email || '')
      : this.normalizeSubId1(this.form.controls.subId1.value);
    const selectedPlatformId = Number(this.form.controls.platformId.value || 0);
    const effectivePlatformId = Number.isInteger(selectedPlatformId) && selectedPlatformId > 0 ? selectedPlatformId : null;

    if (this.authService.isAdmin() && !effectivePlatformId) {
      this.errorMessage$.next('Selecione uma plataforma SHOPEE para gerar links.');
      return;
    }

    this.isSaving$.next(true);
    this.errorMessage$.next(null);
    this.successMessage$.next(null);
    this.processingResults$.next([]);

    this.submitShopeeCreate({
      originalLinks,
      subId1: subIdValue,
      platformId: effectivePlatformId
    });
  }

  protected remove(link: AffiliateLink): void {
    if (!confirm(`Excluir o registro #${link.id}?`)) {
      return;
    }

    this.errorMessage$.next(null);
    this.successMessage$.next(null);

    this.affiliateLinkService.delete(link.id).subscribe({
      next: () => {
        this.successMessage$.next(`Registro #${link.id} removido com sucesso.`);
        this.refresh$.next();
      },
      error: (error) => {
        this.errorMessage$.next(error?.error?.message || 'Nao foi possivel remover o registro.');
      }
    });
  }

  protected copyToClipboard(value: string): void {
    this.copyTextToClipboard(value).then((copied) => {
      if (copied) {
        this.successMessage$.next('Link copiado.');
      } else {
        this.errorMessage$.next('Nao foi possivel copiar o link.');
      }
    });
  }

  protected copyGeneratedShortLinks(): void {
    const shortLinks = this.processingResults$
      .getValue()
      .map((item) => item.shortLink?.trim() || '')
      .filter((shortLink) => shortLink.length > 0);

    if (!shortLinks.length) {
      return;
    }

    this.copyTextToClipboard(shortLinks.join('\n')).then((copied) => {
      if (!copied) {
        this.errorMessage$.next('Nao foi possivel copiar os shortlinks.');
        return;
      }

      this.snackBar.open('Shortlinks copiados!', 'Fechar', {
        duration: 2500
      });
    });
  }

  protected clearHistory(): void {
    if (!confirm('Deseja limpar todo o historico visivel para seu perfil?')) {
      return;
    }

    this.errorMessage$.next(null);
    this.successMessage$.next(null);

    this.affiliateLinkService.clearAll().subscribe({
      next: ({ deletedCount }) => {
        this.successMessage$.next(`${deletedCount} registro(s) removido(s) do historico.`);
        this.refresh$.next();
      },
      error: (error) => {
        this.errorMessage$.next(error?.error?.message || 'Nao foi possivel limpar o historico.');
      }
    });
  }

  protected submitButtonLabel(isSaving: boolean | null): string {
    if (isSaving) {
      return 'Gerando e salvando...';
    }

    return 'Gerar';
  }

  private submitShopeeCreate(input: {
    originalLinks: string[];
    subId1: string | null;
    platformId: number | null;
  }): void {
    const payload: {
      platformId?: number;
      originUrls: string[];
      subId1?: string;
    } = {
      originUrls: input.originalLinks,
      subId1: input.subId1 || undefined
    };

    if (this.authService.isAdmin() && input.platformId) {
      payload.platformId = input.platformId;
    }

    this.affiliateLinkService
      .generateShopeeShortLinks(payload)
      .subscribe({
        next: ({ results }) => {
          const generated = Array.isArray(results) ? results : [];
          const successItems = generated.filter((item) => item.success && item.shortLink);

          this.processingResults$.next(generated.map((item) => this.toProcessResult(item)));

          if (!successItems.length) {
            this.isSaving$.next(false);
            this.errorMessage$.next('Nenhum shortlink foi gerado. Verifique os erros por item abaixo.');
            return;
          }

          this.affiliateLinkService
            .createFromGenerated({
              generatedLinks: successItems.map((item) => ({
                originUrl: item.originUrl,
                shortLink: item.shortLink!
              })),
              subId1: input.subId1
            })
            .subscribe({
              next: ({ links }) => {
                this.isSaving$.next(false);

                const processResults = generated.map((item) => {
                  if (!item.success || !item.shortLink) {
                    return this.toProcessResult(item);
                  }

                  return {
                    originUrl: item.originUrl,
                    status: 'saved',
                    shortLink: item.shortLink,
                    message: 'Shortlink gerado e salvo no historico.'
                  } satisfies LinkProcessResult;
                });

                this.processingResults$.next(processResults);

                const savedCount = Array.isArray(links) ? links.length : 0;
                const failedCount = generated.length - savedCount;
                this.successMessage$.next(
                  `${savedCount} link(s) salvo(s) com sucesso.${failedCount > 0 ? ` ${failedCount} com erro.` : ''}`
                );
                this.form.controls.originalLinksText.setValue('');
                this.form.controls.originalLinksText.markAsPristine();
                this.form.controls.originalLinksText.markAsUntouched();
                this.form.controls.originalLinksText.updateValueAndValidity();
                this.refresh$.next();

                this.dialog.open(AffiliateLinksResultsDialogComponent, {
                  width: '780px',
                  maxWidth: '95vw',
                  data: {
                    results: processResults
                  }
                });
              },
              error: (error) => {
                this.isSaving$.next(false);
                this.errorMessage$.next(error?.error?.message || 'Nao foi possivel salvar os shortlinks gerados.');
              }
            });
        },
        error: (error) => {
          this.isSaving$.next(false);
          this.errorMessage$.next(
            this.toShopeeFriendlyError(error?.error?.message || 'Nao foi possivel gerar shortlinks na Shopee.')
          );
        }
      });
  }

  private toProcessResult(item: ShopeeShortLinkResult): LinkProcessResult {
    if (item.success && item.shortLink) {
      return {
        originUrl: item.originUrl,
        status: 'saved',
        shortLink: item.shortLink,
        message: 'Shortlink gerado.'
      };
    }

    return {
      originUrl: item.originUrl,
      status: 'error',
      message: item.error || 'Falha ao gerar shortlink.'
    };
  }

  private toShopeeFriendlyError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('inativa')) {
      return 'A plataforma Shopee selecionada esta inativa. Um ADMIN precisa ativa-la em Plataforma de Compras.';
    }

    if (normalized.includes('credenciais') || normalized.includes('app id') || normalized.includes('secret')) {
      return 'A plataforma Shopee esta sem credenciais validas. Um ADMIN precisa cadastrar App ID e Secret.';
    }

    if (normalized.includes('empresa sem plataforma shopee')) {
      return 'Peca ao admin para vincular a Shopee na Empresa.';
    }

    return message;
  }

  private isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private normalizeSubId1(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized.length ? normalized : null;
  }

  private loadAdminPlatforms(): void {
    if (!this.authService.isAdmin()) {
      this.adminShopeePlatforms = [];
      this.form.controls.platformId.setValue(null, { emitEvent: false });
      return;
    }

    this.purchasePlatformService.list().subscribe({
      next: ({ platforms }) => {
        this.adminShopeePlatforms = (Array.isArray(platforms) ? platforms : []).filter(
          (platform) => platform.type === 'SHOPEE' && platform.isActive
        );

        const selectedPlatformId = Number(this.form.controls.platformId.value || 0);
        const selectedExists = this.adminShopeePlatforms.some((platform) => platform.id === selectedPlatformId);

        if (!selectedExists) {
          this.form.controls.platformId.setValue(this.getDefaultAdminPlatformId(), { emitEvent: false });
        }
      },
      error: () => {
        this.adminShopeePlatforms = [];
        this.form.controls.platformId.setValue(null, { emitEvent: false });
      }
    });
  }

  private getDefaultAdminPlatformId(): number | null {
    if (!this.authService.isAdmin()) {
      return null;
    }

    return this.adminShopeePlatforms.length === 1 ? this.adminShopeePlatforms[0].id : null;
  }

  private getUsernameFromEmail(email: string): string {
    return email.split('@')[0].trim().toLowerCase();
  }

  private syncAutoSubId1WithCurrentUser(): void {
    if (!this.form.controls.useAutoSubId1.value) {
      return;
    }

    this.form.controls.subId1.setValue(
      this.getUsernameFromEmail(this.authService.currentUser()?.username || this.authService.currentUser()?.email || '')
    );
    this.form.controls.subId1.disable();
  }

  private normalizeLinksInput(value: string): { links: string[]; wasTruncated: boolean } {
    const parsed = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return {
      links: parsed.slice(0, MAX_LINKS_PER_BATCH),
      wasTruncated: parsed.length > MAX_LINKS_PER_BATCH
    };
  }

  private applyOriginalLinksInput(value: string): void {
    const { links, wasTruncated } = this.normalizeLinksInput(value);
    this.normalizedLinks$.next(links);

    if (wasTruncated) {
      this.form.controls.originalLinksText.setValue(links.join('\n'), { emitEvent: false });
      this.snackBar.open(`Voce pode enviar no maximo ${MAX_LINKS_PER_BATCH} links por vez. Mantivemos os primeiros ${MAX_LINKS_PER_BATCH}.`, 'Fechar', {
        duration: 3500
      });
    }

    this.form.controls.originalLinksText.updateValueAndValidity({ emitEvent: false });
  }

  private originalLinksValidator(control: AbstractControl): ValidationErrors | null {
    const { links } = this.normalizeLinksInput((control.value as string) ?? '');

    if (!links.length) {
      return { required: true };
    }

    if (links.length > MAX_LINKS_PER_BATCH) {
      return { maxLinks: true };
    }

    if (links.some((link) => !this.isValidUrl(link))) {
      return { invalidLink: true };
    }

    return null;
  }

  private applyHistoryFilters(
    links: AffiliateLink[],
    filters: {
      dateRange?: { start?: Date | null; end?: Date | null } | null;
      employeeId?: number | null;
    },
    employees: EmployeeOption[]
  ): AffiliateLink[] {
    const start = this.startOfDay(filters.dateRange?.start || null);
    const end = this.endOfDay(filters.dateRange?.end || null);
    const selectedEmployee = employees.find((employee) => employee.id === Number(filters.employeeId || 0)) || null;

    return links.filter((link) => {
      if (!this.matchesDateRange(link, start, end)) {
        return false;
      }

      if (!filters.employeeId || !this.authService.isOwner()) {
        return true;
      }

      if (link.createdByUserId && link.createdByUserId === filters.employeeId) {
        return true;
      }

      if (!selectedEmployee) {
        return false;
      }

      const createdByName = (link.createdByUser?.fullName || (link as { createdBy?: { name?: string } }).createdBy?.name || '')
        .trim()
        .toLowerCase();
      const createdByEmail = (link.createdByUser?.email || '').trim().toLowerCase();
      return (
        (createdByName.length > 0 && createdByName === selectedEmployee.label.trim().toLowerCase()) ||
        (createdByEmail.length > 0 && createdByEmail === (selectedEmployee.email || '').trim().toLowerCase())
      );
    });
  }

  private matchesDateRange(link: AffiliateLink, start: Date | null, end: Date | null): boolean {
    if (!start && !end) {
      return true;
    }

    const linkDate = new Date(link.createdAt || link.updatedAt);
    const linkTime = linkDate.getTime();

    if (Number.isNaN(linkTime)) {
      return false;
    }

    if (start && linkTime < start.getTime()) {
      return false;
    }

    if (end && linkTime > end.getTime()) {
      return false;
    }

    return true;
  }

  private startOfDay(date: Date | null): Date | null {
    if (!date) {
      return null;
    }

    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private endOfDay(date: Date | null): Date | null {
    if (!date) {
      return null;
    }

    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }

  private getTodayStart(): Date {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getTodayEnd(): Date {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private toEmployeeOptions(users: User[] | null | undefined): EmployeeOption[] {
    const currentCompanyId = this.authService.currentUser()?.companyId ?? null;
    const safeUsers = Array.isArray(users) ? users : [];
    const companyUsers =
      currentCompanyId === null ? safeUsers : safeUsers.filter((user) => (user.companyId ?? null) === currentCompanyId);

    return companyUsers
      .map((user) => ({
        id: user.id,
        label: user.fullName?.trim() || user.username || user.email || `user-${user.id}`,
        email: user.email
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
}
