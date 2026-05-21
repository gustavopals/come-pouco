import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export type PublicConversionOutcome = 'success' | 'fallback' | 'error';
export type PublicRedirectSource = 'auto' | 'manual';

interface PublicAnalyticsBaseEvent {
  companySlug: string;
  employeeSlug?: string | null;
  conversionId?: string;
}

export interface PublicConversionViewEvent extends PublicAnalyticsBaseEvent {
  status: PublicConversionOutcome;
  errorCode?: string;
}

export interface PublicRedirectClickEvent extends PublicAnalyticsBaseEvent {
  status: Exclude<PublicConversionOutcome, 'error'>;
  source: PublicRedirectSource;
}

@Injectable({ providedIn: 'root' })
export class PublicAnalyticsService {
  private readonly document = inject(DOCUMENT);

  trackConversionView(event: PublicConversionViewEvent): void {
    this.dispatch('public_conversion_view', event);
  }

  trackRedirectClick(event: PublicRedirectClickEvent): void {
    this.dispatch('public_redirect_click', event);
  }

  private dispatch(
    name: string,
    detail: PublicConversionViewEvent | PublicRedirectClickEvent,
  ): void {
    const view = this.document.defaultView;

    if (!view) {
      return;
    }

    view.dispatchEvent(
      new view.CustomEvent(`auralinks:${name}`, {
        detail: {
          ...detail,
          occurredAt: new Date().toISOString(),
        },
      }),
    );
  }
}
