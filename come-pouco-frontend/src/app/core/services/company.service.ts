import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Company, CreateCompanyPayload, UpdateCompanyPayload } from '../models/company.model';
import { PaginatedResponse, PaginationParams } from '../models/pagination.model';
import { buildPaginationParams, collectPaginatedItems } from './pagination-params';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  constructor(private readonly http: HttpClient) {}

  list(
    pagination?: PaginationParams,
  ): Observable<{ companies: Company[] } & PaginatedResponse<Company>> {
    return this.http.get<{ companies: Company[] } & PaginatedResponse<Company>>(
      `${environment.apiUrl}/companies`,
      {
        params: buildPaginationParams(pagination),
      },
    );
  }

  listAll(): Observable<Company[]> {
    return collectPaginatedItems(
      (page, limit) => this.list({ page, limit }),
      (response) =>
        Array.isArray(response.companies) ? response.companies : (response.items ?? []),
    );
  }

  create(payload: CreateCompanyPayload): Observable<{ company: Company }> {
    return this.http.post<{ company: Company }>(`${environment.apiUrl}/companies`, payload);
  }

  update(id: number, payload: UpdateCompanyPayload): Observable<{ company: Company }> {
    return this.http.put<{ company: Company }>(`${environment.apiUrl}/companies/${id}`, payload);
  }
}
