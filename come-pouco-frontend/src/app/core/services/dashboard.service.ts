import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductionSummary {
  todayCount: number;
  avgLast7Days: number;
  maxLast7Days: number;
  minLast7Days: number;
}

export type ConversionDashboardRange = '7d' | '30d' | '90d';
export type ConversionTimelineBucket = 'day' | 'hour';

export interface ConversionDashboardParams {
  range?: ConversionDashboardRange;
  employeeId?: number | null;
  limit?: number;
  bucket?: ConversionTimelineBucket;
}

export interface ConversionSummary {
  range: ConversionDashboardRange;
  from: string;
  to: string;
  total: number;
  successCount: number;
  fallbackCount: number;
  errorCount: number;
  botDetectedCount: number;
  successRate: number;
  fallbackRate: number;
  averageDaily: number;
  landingActive: boolean;
  activeLandingCount: number;
}

export interface ConversionTopProduct {
  itemId: string;
  shopId: string | null;
  productName: string | null;
  total: number;
}

export interface ConversionTopProductsResponse {
  range: ConversionDashboardRange;
  items: ConversionTopProduct[];
}

export interface ConversionByEmployee {
  employeeId: number | null;
  employeeName: string;
  employeeSlug: string;
  total: number;
  success: number;
  fallback: number;
  error: number;
  botDetected: number;
  successRate: number;
  fallbackRate: number;
}

export interface ConversionsByEmployeeResponse {
  range: ConversionDashboardRange;
  items: ConversionByEmployee[];
}

export interface ConversionTimelineItem {
  bucketStart: string;
  total: number;
  success: number;
  fallback: number;
  error: number;
  botDetected: number;
}

export interface ConversionTimelineResponse {
  range: ConversionDashboardRange;
  bucket: ConversionTimelineBucket;
  items: ConversionTimelineItem[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  getProductionSummary(): Observable<ProductionSummary> {
    return this.http.get<ProductionSummary>(`${environment.apiUrl}/dashboard/production-summary`);
  }

  getConversionSummary(params: ConversionDashboardParams = {}): Observable<ConversionSummary> {
    return this.http.get<ConversionSummary>(`${environment.apiUrl}/dashboard/conversions/summary`, {
      params: this.toParams(params),
    });
  }

  getConversionTopProducts(
    params: ConversionDashboardParams = {},
  ): Observable<ConversionTopProductsResponse> {
    return this.http.get<ConversionTopProductsResponse>(
      `${environment.apiUrl}/dashboard/conversions/top-products`,
      {
        params: this.toParams(params),
      },
    );
  }

  getConversionsByEmployee(
    params: ConversionDashboardParams = {},
  ): Observable<ConversionsByEmployeeResponse> {
    return this.http.get<ConversionsByEmployeeResponse>(
      `${environment.apiUrl}/dashboard/conversions/by-employee`,
      {
        params: this.toParams(params),
      },
    );
  }

  getConversionTimeline(
    params: ConversionDashboardParams = {},
  ): Observable<ConversionTimelineResponse> {
    return this.http.get<ConversionTimelineResponse>(
      `${environment.apiUrl}/dashboard/conversions/timeline`,
      {
        params: this.toParams(params),
      },
    );
  }

  private toParams(params: ConversionDashboardParams): HttpParams {
    let httpParams = new HttpParams();

    if (params.range) {
      httpParams = httpParams.set('range', params.range);
    }

    if (params.employeeId) {
      httpParams = httpParams.set('employeeId', params.employeeId);
    }

    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit);
    }

    if (params.bucket) {
      httpParams = httpParams.set('bucket', params.bucket);
    }

    return httpParams;
  }
}
