import { CommonModule, DatePipe } from '@angular/common';
import { SelectionModel } from '@angular/cdk/collections';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { AffiliateLinksResultsDialogComponent } from './affiliate-links-results-dialog.component';
import { AffiliateLink, ShopeeShortLinkResult } from '../../core/models/affiliate-link.model';
import { PurchasePlatform } from '../../core/models/purchase-platform.model';
import { User } from '../../core/models/user.model';
import { AffiliateLinkService } from '../../core/services/affiliate-link.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';
import { UserService } from '../../core/services/user.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  CrudDrawerComponent,
  EmptyStateComponent,
  IconButtonComponent,
  IconComponent,
  PageHeaderComponent,
  ResponsiveTableComponent,
  SkeletonLoaderComponent,
  StatusChipComponent,
} from '../../shared/components';

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
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    CrudDrawerComponent,
    EmptyStateComponent,
    IconButtonComponent,
    IconComponent,
    PageHeaderComponent,
    ResponsiveTableComponent,
    SkeletonLoaderComponent,
    StatusChipComponent,
  ],
  templateUrl: './affiliate-links.component.html',
  styleUrl: './affiliate-links.component.scss',
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
    'select',
    'createdBy',
    'originalLink',
    'affiliateLink',
    'updatedAt',
    'actions',
  ];
  protected readonly displayedColumnsDefault: string[] = [
    'select',
    'originalLink',
    'affiliateLink',
    'updatedAt',
    'actions',
  ];
  protected readonly selection = new SelectionModel<number>(true, []);
  protected currentFilteredLinks: AffiliateLink[] = [];
  protected visibleFilteredLinks: AffiliateLink[] = [];

  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly isSaving$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected readonly normalizedLinks$ = new BehaviorSubject<string[]>([]);
  protected adminShopeePlatforms: PurchasePlatform[] = [];
  protected readonly pageSizeOptions = [10, 25, 50, 100];
  protected readonly pageState$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: 10,
  });
  protected readonly totalLinks$ = new BehaviorSubject<number>(0);
  protected readonly historySearchControl = this.formBuilder.control('');
  protected readonly filtersForm = this.formBuilder.group({
    dateRange: this.formBuilder.group({
      start: [this.getTodayStart()],
      end: [this.getTodayEnd()],
    }),
    employeeId: [null as number | null],
  });

  protected readonly drawerOpen = signal(false);
  protected readonly drawerError = signal<string | null>(null);

  protected readonly links$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.pageState$,
  ]).pipe(
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(([, pageState]) =>
      this.affiliateLinkService.list(this.buildHistoryListParams(pageState)).pipe(
        map((response) => {
          const rawLinks = Array.isArray(response?.links) ? response.links : [];
          const links = rawLinks.filter((link): link is AffiliateLink =>
            this.isValidAffiliateLinkRow(link),
          );
          this.totalLinks$.next(this.resolveTableTotal(response.meta?.total, rawLinks, links));
          return links;
        }),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar os links.');
          this.totalLinks$.next(0);
          return of([] as AffiliateLink[]);
        }),
        finalize(() => this.isLoading$.next(false)),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly employees$ = (this.authService.isOwner()
    ? this.userService.listAllUsers().pipe(
        map((users) => this.toEmployeeOptions(users)),
        catchError(() => of([] as EmployeeOption[])),
      )
    : of([] as EmployeeOption[])
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  protected readonly filteredLinks$ = this.links$.pipe(
    tap((links) => {
      this.currentFilteredLinks = links;
      const visibleIds = new Set(links.map((item) => item.id));
      this.selection.selected
        .filter((selectedId) => !visibleIds.has(selectedId))
        .forEach((selectedId) => this.selection.deselect(selectedId));
    }),
  );
  protected readonly filteredTotalLinks$ = this.totalLinks$.asObservable();
  protected readonly pagedLinks$ = this.filteredLinks$.pipe(
    tap((links) => {
      this.visibleFilteredLinks = links;
    }),
  );
  protected readonly maxLinksPerBatch = MAX_LINKS_PER_BATCH;

  protected readonly form = this.formBuilder.group({
    originalLinksText: ['', [Validators.required, this.originalLinksValidator.bind(this)]],
    subId1: ['', [Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    platformId: [null as number | null],
    useAutoSubId1: [false],
  });
  protected readonly linksCount$ = this.normalizedLinks$.pipe(
    map((links) => links.length),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  ngOnInit(): void {
    this.authService.me().subscribe({
      next: () => {
        this.syncAutoSubId1WithCurrentUser();
        this.loadAdminPlatforms();
      },
      error: () => {
        this.errorMessage$.next('Nao foi possivel atualizar o contexto da empresa.');
        this.loadAdminPlatforms();
      },
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

    this.form.controls.originalLinksText.valueChanges.subscribe((value) =>
      this.applyOriginalLinksInput(value || ''),
    );
    this.filtersForm.valueChanges.subscribe(() => {
      this.resetHistoryPage();
      this.selection.clear();
    });
    this.historySearchControl.valueChanges.subscribe(() => {
      this.resetHistoryPage();
      this.selection.clear();
    });

    this.syncAutoSubId1WithCurrentUser();
    this.loadAdminPlatforms();
    this.applyOriginalLinksInput(this.form.controls.originalLinksText.value || '');
  }

  protected get displayedColumns(): string[] {
    return this.authService.isOwner()
      ? this.displayedColumnsWithCreator
      : this.displayedColumnsDefault;
  }

  protected loadLinks(): void {
    this.selection.clear();
    this.refresh$.next();
  }

  protected clearFilters(): void {
    this.historySearchControl.setValue('');
    this.filtersForm.reset({
      dateRange: {
        start: null,
        end: null,
      },
      employeeId: null,
    });
    this.selection.clear();
  }

  protected setTodayDateRange(): void {
    this.filtersForm.controls.dateRange.patchValue({
      start: this.getTodayStart(),
      end: this.getTodayEnd(),
    });
    this.selection.clear();
  }

  protected handlePage(event: PageEvent): void {
    this.pageState$.next({
      pageIndex: event.pageIndex,
      pageSize: event.pageSize,
    });
  }

  protected isTodayDateRangeSelected(): boolean {
    const start = this.filtersForm.controls.dateRange.controls.start.value;
    const end = this.filtersForm.controls.dateRange.controls.end.value;

    if (!start || !end) {
      return false;
    }

    return (
      this.startOfDay(start)?.getTime() === this.getTodayStart().getTime() &&
      this.endOfDay(end)?.getTime() === this.getTodayEnd().getTime()
    );
  }

  protected openGenerateDrawer(): void {
    this.drawerError.set(null);
    this.form.reset({
      originalLinksText: '',
      subId1: '',
      platformId: this.getDefaultAdminPlatformId(),
      useAutoSubId1: false,
    });
    this.form.controls.subId1.enable();
    this.normalizedLinks$.next([]);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    if (this.isSaving$.getValue()) {
      return;
    }
    this.drawerOpen.set(false);
    this.drawerError.set(null);
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
      ? this.getUsernameFromEmail(
          this.authService.currentUser()?.username || this.authService.currentUser()?.email || '',
        )
      : this.normalizeSubId1(this.form.controls.subId1.value);
    const selectedPlatformId = Number(this.form.controls.platformId.value || 0);
    const effectivePlatformId =
      Number.isInteger(selectedPlatformId) && selectedPlatformId > 0 ? selectedPlatformId : null;

    if (this.authService.isAdmin() && !effectivePlatformId) {
      this.drawerError.set('Selecione uma plataforma SHOPEE para gerar links.');
      return;
    }

    this.isSaving$.next(true);
    this.drawerError.set(null);

    this.submitShopeeCreate({
      originalLinks,
      subId1: subIdValue,
      platformId: effectivePlatformId,
    });
  }

  protected remove(link: AffiliateLink): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Excluir link',
        message: `Excluir o registro #${link.id} do historico?`,
        confirmText: 'Excluir',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.affiliateLinkService.delete(link.id).subscribe({
        next: () => {
          this.selection.deselect(link.id);
          this.snackBar.open(`Registro #${link.id} removido.`, 'OK', { duration: 3000 });
          this.refresh$.next();
        },
        error: (error) => {
          this.snackBar.open(
            error?.error?.message || 'Nao foi possivel remover o registro.',
            'Fechar',
            { duration: 3500 },
          );
        },
      });
    });
  }

  protected copyToClipboard(value: string): void {
    void this.copyTextToClipboard(value).then((copied) => {
      if (copied) {
        this.snackBar.open('Link copiado.', 'OK', { duration: 2000 });
      } else {
        this.snackBar.open('Nao foi possivel copiar o link.', 'Fechar', { duration: 3000 });
      }
    });
  }

  protected isAllSelected(): boolean {
    return (
      this.visibleFilteredLinks.length > 0 &&
      this.visibleFilteredLinks.every((item) => this.selection.isSelected(item.id))
    );
  }

  protected masterToggle(): void {
    if (this.isAllSelected()) {
      this.visibleFilteredLinks.forEach((row) => this.selection.deselect(row.id));
      return;
    }

    this.visibleFilteredLinks.forEach((row) => this.selection.select(row.id));
  }

  protected toggleRow(row: AffiliateLink): void {
    this.selection.toggle(row.id);
  }

  protected checkboxLabel(row?: AffiliateLink): string {
    if (!row) {
      return `${this.isAllSelected() ? 'Desmarcar' : 'Selecionar'} todos`;
    }

    return `${this.selection.isSelected(row.id) ? 'Desmarcar' : 'Selecionar'} registro #${row.id}`;
  }

  protected copySelectedLinks(): void {
    const selected = this.getSelectedRows();
    if (!selected.length) {
      return;
    }

    const content = selected.map((item) => item.affiliateLink).join('\n');
    void this.copyTextToClipboard(content).then((copied) => {
      if (!copied) {
        this.snackBar.open('Nao foi possivel copiar os links selecionados.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      this.snackBar.open(`${selected.length} link(s) copiado(s).`, 'OK', {
        duration: 2500,
      });
    });
  }

  protected removeSelectedLinks(): void {
    const selected = this.getSelectedRows();
    if (!selected.length) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Excluir selecionados',
        message: `Excluir ${selected.length} registro(s) selecionado(s)? Esta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      const results = await Promise.allSettled(
        selected.map((item) => firstValueFrom(this.affiliateLinkService.delete(item.id))),
      );
      const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - deletedCount;

      if (deletedCount > 0) {
        this.snackBar.open(`${deletedCount} registro(s) removido(s).`, 'OK', { duration: 3000 });
      }

      if (failedCount > 0) {
        this.snackBar.open(
          failedCount === results.length
            ? 'Nao foi possivel remover os registros selecionados.'
            : `${failedCount} registro(s) nao puderam ser removido(s).`,
          'Fechar',
          { duration: 3500 },
        );
      }

      this.selection.clear();
      this.refresh$.next();
    });
  }

  protected clearSelection(): void {
    this.selection.clear();
  }

  protected clearHistory(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: {
        title: 'Limpar historico',
        message:
          'Deseja limpar todo o historico disponivel para seu perfil? Esta acao nao pode ser desfeita.',
        confirmText: 'Limpar tudo',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.affiliateLinkService.clearAll().subscribe({
        next: ({ deletedCount }) => {
          this.selection.clear();
          this.snackBar.open(`${deletedCount} registro(s) removido(s).`, 'OK', { duration: 3000 });
          this.refresh$.next();
        },
        error: (error) => {
          this.snackBar.open(
            error?.error?.message || 'Nao foi possivel limpar o historico.',
            'Fechar',
            { duration: 3500 },
          );
        },
      });
    });
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
      subId1: input.subId1 || undefined,
    };

    if (this.authService.isAdmin() && input.platformId) {
      payload.platformId = input.platformId;
    }

    this.affiliateLinkService.generateShopeeShortLinks(payload).subscribe({
      next: ({ results }) => {
        const generated = Array.isArray(results) ? results : [];
        const successItems = generated.filter((item) => item.success && item.shortLink);

        if (!successItems.length) {
          this.isSaving$.next(false);
          this.drawerError.set('Nenhum shortlink foi gerado. Verifique os erros por item.');
          this.openResultsDialog(generated.map((item) => this.toProcessResult(item)));
          return;
        }

        this.affiliateLinkService
          .createFromGenerated({
            generatedLinks: successItems.map((item) => ({
              originUrl: item.originUrl,
              shortLink: item.shortLink!,
            })),
            subId1: input.subId1,
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
                  message: 'Shortlink gerado e salvo no historico.',
                } satisfies LinkProcessResult;
              });

              const savedCount = Array.isArray(links) ? links.length : 0;
              const failedCount = generated.length - savedCount;

              this.snackBar.open(
                `${savedCount} link(s) salvo(s) com sucesso.${failedCount > 0 ? ` ${failedCount} com erro.` : ''}`,
                'OK',
                { duration: 4000 },
              );

              this.selection.clear();
              this.refresh$.next();
              this.drawerOpen.set(false);
              this.openResultsDialog(processResults);
            },
            error: (error) => {
              this.isSaving$.next(false);
              this.drawerError.set(
                error?.error?.message || 'Nao foi possivel salvar os shortlinks gerados.',
              );
            },
          });
      },
      error: (error) => {
        this.isSaving$.next(false);
        this.drawerError.set(
          this.toShopeeFriendlyError(
            error?.error?.message || 'Nao foi possivel gerar shortlinks na Shopee.',
          ),
        );
      },
    });
  }

  private openResultsDialog(results: LinkProcessResult[]): void {
    this.dialog.open(AffiliateLinksResultsDialogComponent, {
      width: '780px',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-responsive-dialog',
      data: { results },
    });
  }

  private toProcessResult(item: ShopeeShortLinkResult): LinkProcessResult {
    if (item.success && item.shortLink) {
      return {
        originUrl: item.originUrl,
        status: 'saved',
        shortLink: item.shortLink,
        message: 'Shortlink gerado.',
      };
    }

    return {
      originUrl: item.originUrl,
      status: 'error',
      message: item.error || 'Falha ao gerar shortlink.',
    };
  }

  private toShopeeFriendlyError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('inativa')) {
      return 'A plataforma Shopee selecionada esta inativa. Um ADMIN precisa ativa-la em Plataforma de Compras.';
    }

    if (
      normalized.includes('credenciais') ||
      normalized.includes('app id') ||
      normalized.includes('secret')
    ) {
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

    this.purchasePlatformService.listAll().subscribe({
      next: (platforms) => {
        this.adminShopeePlatforms = (Array.isArray(platforms) ? platforms : []).filter(
          (platform) => platform.type === 'SHOPEE' && platform.isActive,
        );

        const selectedPlatformId = Number(this.form.controls.platformId.value || 0);
        const selectedExists = this.adminShopeePlatforms.some(
          (platform) => platform.id === selectedPlatformId,
        );

        if (!selectedExists) {
          this.form.controls.platformId.setValue(this.getDefaultAdminPlatformId(), {
            emitEvent: false,
          });
        }
      },
      error: () => {
        this.adminShopeePlatforms = [];
        this.form.controls.platformId.setValue(null, { emitEvent: false });
      },
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
      this.getUsernameFromEmail(
        this.authService.currentUser()?.username || this.authService.currentUser()?.email || '',
      ),
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
      wasTruncated: parsed.length > MAX_LINKS_PER_BATCH,
    };
  }

  private applyOriginalLinksInput(value: string): void {
    const { links, wasTruncated } = this.normalizeLinksInput(value);
    this.normalizedLinks$.next(links);

    if (wasTruncated) {
      this.form.controls.originalLinksText.setValue(links.join('\n'), { emitEvent: false });
      this.snackBar.open(
        `Voce pode enviar no maximo ${MAX_LINKS_PER_BATCH} links por vez. Mantivemos os primeiros ${MAX_LINKS_PER_BATCH}.`,
        'Fechar',
        {
          duration: 3500,
        },
      );
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

  private buildHistoryListParams(pageState: { pageIndex: number; pageSize: number }): {
    page: number;
    limit: number;
    search?: string;
    createdByUserId?: number;
    startDate?: string;
    endDate?: string;
  } {
    const filters = this.filtersForm.getRawValue();
    const start = this.startOfDay(filters.dateRange?.start || null);
    const end = this.endOfDay(filters.dateRange?.end || null);
    const search = (this.historySearchControl.value || '').trim();
    const createdByUserId =
      this.authService.isOwner() && filters.employeeId ? Number(filters.employeeId) : undefined;

    return {
      page: pageState.pageIndex + 1,
      limit: pageState.pageSize,
      search: search.length ? search : undefined,
      createdByUserId,
      startDate: start ? start.toISOString() : undefined,
      endDate: end ? end.toISOString() : undefined,
    };
  }

  private toEmployeeOptions(users: User[] | null | undefined): EmployeeOption[] {
    const currentCompanyId = this.authService.currentUser()?.companyId ?? null;
    const safeUsers = Array.isArray(users) ? users : [];
    const companyUsers =
      currentCompanyId === null
        ? safeUsers
        : safeUsers.filter((user) => (user.companyId ?? null) === currentCompanyId);

    return companyUsers
      .map((user) => ({
        id: user.id,
        label: user.fullName?.trim() || user.username || user.email || `user-${user.id}`,
        email: user.email,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private isValidAffiliateLinkRow(link: unknown): link is AffiliateLink {
    if (!link || typeof link !== 'object') {
      return false;
    }

    const candidate = link as Partial<AffiliateLink>;

    return (
      typeof candidate.id === 'number' &&
      Number.isFinite(candidate.id) &&
      typeof candidate.originalLink === 'string' &&
      candidate.originalLink.trim().length > 0 &&
      typeof candidate.affiliateLink === 'string' &&
      candidate.affiliateLink.trim().length > 0 &&
      typeof candidate.updatedAt === 'string' &&
      candidate.updatedAt.trim().length > 0
    );
  }

  private resolveTableTotal(
    metaTotal: number | undefined,
    rawRows: unknown[],
    validRows: AffiliateLink[],
  ): number {
    return rawRows.length === validRows.length ? (metaTotal ?? validRows.length) : validRows.length;
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

  private getSelectedRows(): AffiliateLink[] {
    return this.currentFilteredLinks.filter((item) => this.selection.isSelected(item.id));
  }

  private resetHistoryPage(): void {
    const current = this.pageState$.getValue();
    this.pageState$.next({ ...current, pageIndex: 0 });
  }
}
