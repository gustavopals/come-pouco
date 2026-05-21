import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PublicRedirectService {
  private readonly document = inject(DOCUMENT);
  private refreshMeta?: HTMLMetaElement;

  assign(url: string): void {
    this.clearMetaRefresh();
    this.document.defaultView?.location.assign(url);
  }

  setMetaRefresh(url: string, seconds: number): void {
    this.clearMetaRefresh();

    const meta = this.document.createElement('meta');
    meta.httpEquiv = 'refresh';
    meta.content = `${seconds};url=${url}`;

    this.document.head.appendChild(meta);
    this.refreshMeta = meta;
  }

  clearMetaRefresh(): void {
    this.refreshMeta?.remove();
    this.refreshMeta = undefined;
  }
}
