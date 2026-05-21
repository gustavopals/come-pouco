import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PublicRedirectService {
  private readonly document = inject(DOCUMENT);

  openInNewTab(url: string): void {
    this.document.defaultView?.open(url, '_blank', 'noopener,noreferrer');
  }
}
