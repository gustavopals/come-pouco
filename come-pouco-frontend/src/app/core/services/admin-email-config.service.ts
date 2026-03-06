import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SystemEmailConfig, UpdateSystemEmailConfigPayload } from '../models/email-config.model';

@Injectable({ providedIn: 'root' })
export class AdminEmailConfigService {
  constructor(private readonly http: HttpClient) {}

  getConfig(): Observable<{ config: SystemEmailConfig }> {
    return this.http.get<{ config: SystemEmailConfig }>(`${environment.apiUrl}/admin/email-config`);
  }

  updateConfig(payload: UpdateSystemEmailConfigPayload): Observable<{ config: SystemEmailConfig }> {
    return this.http.put<{ config: SystemEmailConfig }>(`${environment.apiUrl}/admin/email-config`, payload);
  }

  testSend(): Observable<{ ok: boolean; message: string }> {
    return this.http.post<{ ok: boolean; message: string }>(`${environment.apiUrl}/admin/email-config/test`, {});
  }
}
