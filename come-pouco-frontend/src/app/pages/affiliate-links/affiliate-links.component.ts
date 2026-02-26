import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import {
  AffiliateLink,
  CreateAffiliateLinkPayload,
  UpdateAffiliateLinkPayload
} from '../../core/models/affiliate-link.model';
import { AuthService } from '../../core/services/auth.service';
import { AffiliateLinkService } from '../../core/services/affiliate-link.service';

@Component({
  selector: 'app-affiliate-links',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './affiliate-links.component.html',
  styleUrl: './affiliate-links.component.scss'
})
export class AffiliateLinksComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly affiliateLinkService = inject(AffiliateLinkService);
  protected readonly authService = inject(AuthService);

  protected links: AffiliateLink[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected editingLinkId: number | null = null;

  protected readonly form = this.formBuilder.group({
    originalLink: ['', [Validators.required]],
    productImage: ['', [Validators.required]],
    catchyPhrase: ['', [Validators.required, Validators.minLength(4)]],
    affiliateLink: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.loadLinks();
  }

  protected loadLinks(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.affiliateLinkService.list().subscribe({
      next: ({ links }) => {
        this.links = links;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Não foi possível carregar os links.';
        this.isLoading = false;
      }
    });
  }

  protected startCreate(): void {
    this.editingLinkId = null;
    this.form.reset({
      originalLink: '',
      productImage: '',
      catchyPhrase: '',
      affiliateLink: ''
    });
  }

  protected startEdit(link: AffiliateLink): void {
    this.editingLinkId = link.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.form.reset({
      originalLink: link.originalLink,
      productImage: link.productImage,
      catchyPhrase: link.catchyPhrase,
      affiliateLink: link.affiliateLink
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

    const { originalLink, productImage, catchyPhrase, affiliateLink } = this.form.getRawValue();

    if (!this.isValidUrl(originalLink!) || !this.isValidUrl(productImage!) || !this.isValidUrl(affiliateLink!)) {
      this.errorMessage = 'Informe URLs válidas para link original, imagem e link afiliado.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isCreateMode()) {
      const payload: CreateAffiliateLinkPayload = {
        originalLink: originalLink!,
        productImage: productImage!,
        catchyPhrase: catchyPhrase!,
        affiliateLink: affiliateLink!
      };

      this.affiliateLinkService.create(payload).subscribe({
        next: ({ link }) => {
          this.isSaving = false;
          this.startCreate();
          this.successMessage = `Link #${link.id} cadastrado com sucesso.`;
          this.loadLinks();
        },
        error: (error) => {
          this.isSaving = false;
          this.errorMessage = error?.error?.message || 'Não foi possível cadastrar o link.';
        }
      });

      return;
    }

    const payload: UpdateAffiliateLinkPayload = {
      originalLink: originalLink || undefined,
      productImage: productImage || undefined,
      catchyPhrase: catchyPhrase || undefined,
      affiliateLink: affiliateLink || undefined
    };

    this.affiliateLinkService.update(this.editingLinkId!, payload).subscribe({
      next: ({ link }) => {
        this.isSaving = false;
        this.startCreate();
        this.successMessage = `Link #${link.id} atualizado com sucesso.`;
        this.loadLinks();
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error?.error?.message || 'Não foi possível atualizar o link.';
      }
    });
  }

  protected remove(link: AffiliateLink): void {
    if (!confirm(`Excluir o registro #${link.id}?`)) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.affiliateLinkService.delete(link.id).subscribe({
      next: () => {
        if (this.editingLinkId === link.id) {
          this.startCreate();
        }

        this.successMessage = `Registro #${link.id} removido com sucesso.`;
        this.loadLinks();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Não foi possível remover o registro.';
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
  }

  protected isCreateMode(): boolean {
    return this.editingLinkId === null;
  }

  protected trackById(_index: number, link: AffiliateLink): number {
    return link.id;
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
