import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductionSummary {
  todayCount: number;
  avgLast7Days: number;
  maxLast7Days: number;
  minLast7Days: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  getProductionSummary(): Observable<ProductionSummary> {
    return this.http.get<ProductionSummary>(`${environment.apiUrl}/dashboard/production-summary`);
  }
}
