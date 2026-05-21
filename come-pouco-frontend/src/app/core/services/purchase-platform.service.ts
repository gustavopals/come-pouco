import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PaginatedResponse, PaginationParams } from '../models/pagination.model';
import {
  CreatePurchasePlatformPayload,
  ApiUsageMode,
  ApiUsageSummary,
  PlatformCompanyLink,
  PurchasePlatform,
  UpdatePlatformCompaniesPayload,
  UpdatePurchasePlatformPayload,
} from '../models/purchase-platform.model';
import { buildPaginationParams, collectPaginatedItems } from './pagination-params';

@Injectable({ providedIn: 'root' })
export class PurchasePlatformService {
  constructor(private readonly http: HttpClient) {}

  list(
    pagination?: PaginationParams,
  ): Observable<{ platforms: PurchasePlatform[] } & PaginatedResponse<PurchasePlatform>> {
    return this.http.get<{ platforms: PurchasePlatform[] } & PaginatedResponse<PurchasePlatform>>(
      `${environment.apiUrl}/purchase-platforms`,
      {
        params: buildPaginationParams(pagination),
      },
    );
  }

  listAll(): Observable<PurchasePlatform[]> {
    return collectPaginatedItems(
      (page, limit) => this.list({ page, limit }),
      (response) =>
        Array.isArray(response.platforms) ? response.platforms : (response.items ?? []),
    );
  }

  create(payload: CreatePurchasePlatformPayload): Observable<{ platform: PurchasePlatform }> {
    return this.http.post<{ platform: PurchasePlatform }>(
      `${environment.apiUrl}/purchase-platforms`,
      payload,
    );
  }

  update(
    id: number,
    payload: UpdatePurchasePlatformPayload,
  ): Observable<{ platform: PurchasePlatform }> {
    return this.http.put<{ platform: PurchasePlatform }>(
      `${environment.apiUrl}/purchase-platforms/${id}`,
      payload,
    );
  }

  listCompanies(id: number): Observable<{ companies: PlatformCompanyLink[] }> {
    return this.http.get<{ companies: PlatformCompanyLink[] }>(
      `${environment.apiUrl}/purchase-platforms/${id}/companies`,
    );
  }

  updateCompanies(
    id: number,
    payload: UpdatePlatformCompaniesPayload,
  ): Observable<{ companies: PlatformCompanyLink[] }> {
    return this.http.put<{ companies: PlatformCompanyLink[] }>(
      `${environment.apiUrl}/purchase-platforms/${id}/companies`,
      payload,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/purchase-platforms/${id}`);
  }

  getApiUsage(filters: {
    companyId?: number;
    userId?: number;
    startDate?: string;
    endDate?: string;
    mode?: ApiUsageMode;
    page?: number;
    limit?: number;
  }): Observable<ApiUsageSummary> {
    let params = new HttpParams();

    if (filters.companyId) {
      params = params.set('companyId', String(filters.companyId));
    }

    if (filters.userId) {
      params = params.set('userId', String(filters.userId));
    }

    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }

    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    if (filters.mode) {
      params = params.set('mode', filters.mode);
    }

    if (filters.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.http.get<ApiUsageSummary>(`${environment.apiUrl}/admin/api-usage`, { params });
  }

  deleteMockApiUsage(filters: {
    companyId?: number;
    startDate?: string;
    endDate?: string;
  }): Observable<{ deletedCount: number }> {
    let params = new HttpParams();

    if (filters.companyId) {
      params = params.set('companyId', String(filters.companyId));
    }

    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }

    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    return this.http.delete<{ deletedCount: number }>(
      `${environment.apiUrl}/admin/api-usage/mock`,
      { params },
    );
  }
}
