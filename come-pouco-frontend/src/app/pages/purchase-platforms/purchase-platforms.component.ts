import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';

import {
  CreatePurchasePlatformPayload,
  PurchasePlatform,
  UpdatePurchasePlatformPayload
} from '../../core/models/purchase-platform.model';
import { AuthService } from '../../core/services/auth.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';

@Component({
  selector: 'app-purchase-platforms',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    MatToolbarModule
  ],
  templateUrl: './purchase-platforms.component.html',
  styleUrl: './purchase-platforms.component.scss'
})
export class PurchasePlatformsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly purchasePlatformService = inject(PurchasePlatformService);
  protected readonly authService = inject(AuthService);

  protected readonly displayedColumns: string[] = ['id', 'name', 'status', 'apiLink', 'updatedAt', 'actions'];
  protected platforms: PurchasePlatform[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected editingPlatformId: number | null = null;

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(3)]],
    isActive: [true],
    apiLink: ['', [Validators.required]],
    accessKey: ['', [Validators.required, Validators.minLength(3)]]
  });

  ngOnInit(): void {
    this.loadPlatforms();
  }

  protected get totalPlatforms(): number {
    return this.platforms.length;
  }

  protected loadPlatforms(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.purchasePlatformService
      .list()
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.platforms = Array.isArray(response?.platforms) ? response.platforms : [];
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'Não foi possível carregar as plataformas.';
          this.platforms = [];
        }
      });
  }

  protected startCreate(): void {
    this.editingPlatformId = null;
    this.form.reset({
      name: '',
      description: '',
      isActive: true,
      apiLink: '',
      accessKey: ''
    });
  }

  protected startEdit(platform: PurchasePlatform): void {
    this.editingPlatformId = platform.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.reset({
      name: platform.name,
      description: platform.description,
      isActive: platform.isActive,
      apiLink: platform.apiLink,
      accessKey: platform.accessKey
    });
  }

  protected cancelEdit(): void {
    this.startCreate();
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description, isActive, apiLink, accessKey } = this.form.getRawValue();

    if (!this.isValidUrl(apiLink!)) {
      this.errorMessage = 'Informe uma URL válida para o link da API.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isCreateMode()) {
      const payload: CreatePurchasePlatformPayload = {
        name: name!,
        description: description!,
        isActive: Boolean(isActive),
        apiLink: apiLink!,
        accessKey: accessKey!
      };

      this.purchasePlatformService.create(payload).subscribe({
        next: ({ platform }) => {
          this.isSaving = false;
          this.startCreate();
          this.successMessage = `Plataforma ${platform.name} criada com sucesso.`;
          this.loadPlatforms();
        },
        error: (error) => {
          this.isSaving = false;
          this.errorMessage = error?.error?.message || 'Não foi possível criar a plataforma.';
        }
      });

      return;
    }

    const payload: UpdatePurchasePlatformPayload = {
      name: name || undefined,
      description: description || undefined,
      isActive: Boolean(isActive),
      apiLink: apiLink || undefined,
      accessKey: accessKey || undefined
    };

    this.purchasePlatformService.update(this.editingPlatformId!, payload).subscribe({
      next: ({ platform }) => {
        this.isSaving = false;
        this.startCreate();
        this.successMessage = `Plataforma ${platform.name} atualizada com sucesso.`;
        this.loadPlatforms();
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error?.error?.message || 'Não foi possível atualizar a plataforma.';
      }
    });
  }

  protected remove(platform: PurchasePlatform): void {
    if (!confirm(`Deseja realmente excluir a plataforma ${platform.name}?`)) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.purchasePlatformService.delete(platform.id).subscribe({
      next: () => {
        if (this.editingPlatformId === platform.id) {
          this.startCreate();
        }

        this.successMessage = `Plataforma ${platform.name} removida com sucesso.`;
        this.loadPlatforms();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Não foi possível remover a plataforma.';
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
  }

  protected isCreateMode(): boolean {
    return this.editingPlatformId === null;
  }

  private isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
