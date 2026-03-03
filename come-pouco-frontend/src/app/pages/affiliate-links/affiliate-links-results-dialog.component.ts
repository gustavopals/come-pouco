import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';

import type { LinkProcessResult } from './affiliate-links.component';

interface AffiliateLinksResultsDialogData {
  results: LinkProcessResult[];
}

@Component({
  selector: 'app-affiliate-links-results-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatTableModule],
  templateUrl: './affiliate-links-results-dialog.component.html',
  styleUrl: './affiliate-links-results-dialog.component.scss'
})
export class AffiliateLinksResultsDialogComponent {
  protected copiedMessage = '';
  protected readonly displayedColumns = ['originUrl', 'shortLink', 'actions'];

  constructor(@Inject(MAT_DIALOG_DATA) protected readonly data: AffiliateLinksResultsDialogData) {}

  protected async copyOne(value: string): Promise<void> {
    const copied = await this.copyToClipboard(value);
    this.copiedMessage = copied ? 'Link copiado.' : 'Nao foi possivel copiar o link.';
  }

  protected async copyAll(): Promise<void> {
    const content = this.data.results
      .map((item) => item.shortLink?.trim() || '')
      .filter((shortLink) => shortLink.length > 0)
      .join('\n');

    if (!content.length) {
      this.copiedMessage = 'Nenhum shortlink para copiar.';
      return;
    }

    const copied = await this.copyToClipboard(content);
    this.copiedMessage = copied ? 'Links copiados!' : 'Nao foi possivel copiar os links.';
  }

  protected openLink(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return this.copyWithExecCommand(text);
      }
    }

    return this.copyWithExecCommand(text);
  }

  private copyWithExecCommand(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }

    return copied;
  }
}
