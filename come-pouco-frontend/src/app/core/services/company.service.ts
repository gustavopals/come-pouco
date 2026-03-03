import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Company, CreateCompanyPayload, UpdateCompanyPayload } from '../models/company.model';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<{ companies: Company[] }> {
    return this.http.get<{ companies: Company[] }>(`${environment.apiUrl}/companies`);
  }

  create(payload: CreateCompanyPayload): Observable<{ company: Company }> {
    return this.http.post<{ company: Company }>(`${environment.apiUrl}/companies`, payload);
  }

  update(id: number, payload: UpdateCompanyPayload): Observable<{ company: Company }> {
    return this.http.put<{ company: Company }>(`${environment.apiUrl}/companies/${id}`, payload);
  }
}
