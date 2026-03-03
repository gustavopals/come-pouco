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
  UpdateAffiliateLinkPayload
} from '../models/affiliate-link.model';

@Injectable({ providedIn: 'root' })
export class AffiliateLinkService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<{ links: AffiliateLink[] }> {
    return this.http.get<{ links: AffiliateLink[] }>(`${environment.apiUrl}/affiliate-links`);
  }

  create(payload: CreateAffiliateLinkPayload): Observable<{ links: AffiliateLink[] }> {
    return this.http.post<{ links: AffiliateLink[] }>(`${environment.apiUrl}/affiliate-links`, payload);
  }

  createFromGenerated(payload: CreateAffiliateLinksFromGeneratedPayload): Observable<{ links: AffiliateLink[] }> {
    return this.http.post<{ links: AffiliateLink[] }>(`${environment.apiUrl}/affiliate-links`, payload);
  }

  generateShopeeShortLinks(payload: GenerateShopeeShortLinksPayload): Observable<{ results: ShopeeShortLinkResult[] }> {
    return this.http.post<{ results: ShopeeShortLinkResult[] }>(`${environment.apiUrl}/integrations/shopee/generate-shortlinks`, payload);
  }

  update(id: number, payload: UpdateAffiliateLinkPayload): Observable<{ link: AffiliateLink }> {
    return this.http.put<{ link: AffiliateLink }>(`${environment.apiUrl}/affiliate-links/${id}`, payload);
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
