import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Subject, catchError, finalize, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { Company } from '../../core/models/company.model';
import { PurchasePlatform } from '../../core/models/purchase-platform.model';
import { CompanyService } from '../../core/services/company.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';

@Component({
  selector: 'app-companies',
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
    MatSelectModule,
    MatTableModule
  ],
  templateUrl: './companies.component.html'
})
export class CompaniesComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly purchasePlatformService = inject(PurchasePlatformService);

  private readonly refresh$ = new Subject<void>();

  protected readonly displayedColumns = ['id', 'name', 'platform', 'createdAt', 'actions'];
  protected shopeePlatforms: PurchasePlatform[] = [];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected isLoadingPlatforms = false;
  protected isSaving = false;
  protected successMessage = '';
  protected editingCompanyId: number | null = null;

  protected readonly companies$ = this.refresh$.pipe(
    startWith(void 0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(() =>
      this.companyService.list().pipe(
        map(({ companies }) => (Array.isArray(companies) ? companies : [])),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar empresas.');
          return of([] as Company[]);
        }),
        finalize(() => this.isLoading$.next(false))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    shopeePlatformId: [null as number | null]
  });

  ngOnInit(): void {
    this.loadShopeePlatforms();
  }

  protected loadCompanies(): void {
    this.refresh$.next();
  }

  protected loadShopeePlatforms(): void {
    this.isLoadingPlatforms = true;

    this.purchasePlatformService
      .list()
      .pipe(finalize(() => (this.isLoadingPlatforms = false)))
      .subscribe({
        next: ({ platforms }) => {
          const all = Array.isArray(platforms) ? platforms : [];
          this.shopeePlatforms = all.filter((item) => item.type === 'SHOPEE' && item.isActive);
        },
        error: () => {
          this.shopeePlatforms = [];
        }
      });
  }

  protected startCreate(): void {
    this.editingCompanyId = null;
    this.form.reset({ name: '', shopeePlatformId: null });
  }

  protected startEdit(company: Company): void {
    this.editingCompanyId = company.id;
    this.form.reset({
      name: company.name,
      shopeePlatformId: company.shopeePlatformId ?? null
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value ?? '';
    const shopeePlatformId = this.form.controls.shopeePlatformId.value;

    this.isSaving = true;
    this.errorMessage$.next(null);
    this.successMessage = '';

    if (this.editingCompanyId === null) {
      this.companyService.create({ name, shopeePlatformId }).subscribe({
        next: ({ company }) => {
          this.isSaving = false;
          this.startCreate();
          this.successMessage = `Empresa ${company.name} criada com sucesso.`;
          this.refresh$.next();
        },
        error: (error) => {
          this.isSaving = false;
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel criar empresa.');
        }
      });

      return;
    }

    this.companyService.update(this.editingCompanyId, { name, shopeePlatformId }).subscribe({
      next: ({ company }) => {
        this.isSaving = false;
        this.startCreate();
        this.successMessage = `Empresa ${company.name} atualizada com sucesso.`;
        this.refresh$.next();
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage$.next(error?.error?.message || 'Nao foi possivel atualizar empresa.');
      }
    });
  }

  protected platformLabel(platform: Company['shopeePlatform']): string {
    if (!platform) {
      return 'Nao vinculada';
    }

    return `${platform.name} (${platform.isActive ? 'Ativa' : 'Inativa'})`;
  }
}
