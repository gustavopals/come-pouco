import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreatePurchasePlatformPayload,
  PurchasePlatform,
  UpdatePurchasePlatformPayload
} from '../models/purchase-platform.model';

@Injectable({ providedIn: 'root' })
export class PurchasePlatformService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<{ platforms: PurchasePlatform[] }> {
    return this.http.get<{ platforms: PurchasePlatform[] }>(`${environment.apiUrl}/purchase-platforms`);
  }

  create(payload: CreatePurchasePlatformPayload): Observable<{ platform: PurchasePlatform }> {
    return this.http.post<{ platform: PurchasePlatform }>(`${environment.apiUrl}/purchase-platforms`, payload);
  }

  update(id: number, payload: UpdatePurchasePlatformPayload): Observable<{ platform: PurchasePlatform }> {
    return this.http.put<{ platform: PurchasePlatform }>(`${environment.apiUrl}/purchase-platforms/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/purchase-platforms/${id}`);
  }
}
