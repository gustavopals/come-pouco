import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdminStatusResponse,
  CreateIncidentPayload,
  Incident,
  IncidentComponentKey,
  IncidentListResponse,
  IncidentSeverity,
  IncidentStatus,
  UpdateIncidentPayload,
} from '../models/admin-status.model';
import { PaginationParams } from '../models/pagination.model';

export interface IncidentListParams extends PaginationParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  component?: IncidentComponentKey;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminStatusService {
  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<AdminStatusResponse> {
    return this.http.get<AdminStatusResponse>(`${environment.apiUrl}/admin/status`);
  }

  listIncidents(params: IncidentListParams = {}): Observable<IncidentListResponse> {
    return this.http.get<IncidentListResponse>(`${environment.apiUrl}/admin/incidents`, {
      params: this.toParams(params),
    });
  }

  createIncident(payload: CreateIncidentPayload): Observable<{ incident: Incident }> {
    return this.http.post<{ incident: Incident }>(`${environment.apiUrl}/admin/incidents`, payload);
  }

  updateIncident(id: string, payload: UpdateIncidentPayload): Observable<{ incident: Incident }> {
    return this.http.patch<{ incident: Incident }>(
      `${environment.apiUrl}/admin/incidents/${id}`,
      payload,
    );
  }

  deleteIncident(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/incidents/${id}`);
  }

  private toParams(params: IncidentListParams): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }
}
