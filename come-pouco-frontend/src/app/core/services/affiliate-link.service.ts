import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AffiliateLink,
  CreateAffiliateLinksFromGeneratedPayload,
  CreateAffiliateLinkPayload,
  GenerateShopeeShortLinksPayload,
  ShopeeShortLinkResult,
  UpdateAffiliateLinkPayload,
} from '../models/affiliate-link.model';
import { PaginatedResponse, PaginationParams } from '../models/pagination.model';
import { buildPaginationParams } from './pagination-params';

export interface AffiliateLinkListParams extends PaginationParams {
  search?: string | null;
  createdByUserId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AffiliateLinkService {
  constructor(private readonly http: HttpClient) {}

  list(
    params?: AffiliateLinkListParams,
  ): Observable<{ links: AffiliateLink[] } & PaginatedResponse<AffiliateLink>> {
    let httpParams = buildPaginationParams(params);

    if (params?.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    if (params?.createdByUserId) {
      httpParams = httpParams.set('createdByUserId', String(params.createdByUserId));
    }

    if (params?.startDate) {
      httpParams = httpParams.set('startDate', params.startDate);
    }

    if (params?.endDate) {
      httpParams = httpParams.set('endDate', params.endDate);
    }

    return this.http.get<{ links: AffiliateLink[] } & PaginatedResponse<AffiliateLink>>(
      `${environment.apiUrl}/affiliate-links`,
      {
        params: httpParams,
      },
    );
  }

  create(payload: CreateAffiliateLinkPayload): Observable<{ links: AffiliateLink[] }> {
    return this.http.post<{ links: AffiliateLink[] }>(
      `${environment.apiUrl}/affiliate-links`,
      payload,
    );
  }

  createFromGenerated(
    payload: CreateAffiliateLinksFromGeneratedPayload,
  ): Observable<{ links: AffiliateLink[] }> {
    return this.http.post<{ links: AffiliateLink[] }>(
      `${environment.apiUrl}/affiliate-links`,
      payload,
    );
  }

  generateShopeeShortLinks(
    payload: GenerateShopeeShortLinksPayload,
  ): Observable<{ results: ShopeeShortLinkResult[] }> {
    return this.http.post<{ results: ShopeeShortLinkResult[] }>(
      `${environment.apiUrl}/integrations/shopee/generate-shortlinks`,
      payload,
    );
  }

  update(id: number, payload: UpdateAffiliateLinkPayload): Observable<{ link: AffiliateLink }> {
    return this.http.put<{ link: AffiliateLink }>(
      `${environment.apiUrl}/affiliate-links/${id}`,
      payload,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/affiliate-links/${id}`);
  }

  clearAll(companyId?: number): Observable<{ deletedCount: number }> {
    const url = companyId
      ? `${environment.apiUrl}/affiliate-links?companyId=${companyId}`
      : `${environment.apiUrl}/affiliate-links`;

    return this.http.delete<{ deletedCount: number }>(url);
  }
}
