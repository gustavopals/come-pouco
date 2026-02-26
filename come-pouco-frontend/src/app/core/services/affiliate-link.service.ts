import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AffiliateLink,
  CreateAffiliateLinkPayload,
  UpdateAffiliateLinkPayload
} from '../models/affiliate-link.model';

@Injectable({ providedIn: 'root' })
export class AffiliateLinkService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<{ links: AffiliateLink[] }> {
    return this.http.get<{ links: AffiliateLink[] }>(`${environment.apiUrl}/affiliate-links`);
  }

  create(payload: CreateAffiliateLinkPayload): Observable<{ link: AffiliateLink }> {
    return this.http.post<{ link: AffiliateLink }>(`${environment.apiUrl}/affiliate-links`, payload);
  }

  update(id: number, payload: UpdateAffiliateLinkPayload): Observable<{ link: AffiliateLink }> {
    return this.http.put<{ link: AffiliateLink }>(`${environment.apiUrl}/affiliate-links/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/affiliate-links/${id}`);
  }
}
