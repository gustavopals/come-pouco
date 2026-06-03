import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LandingConfigResponse, UpdateLandingConfigPayload } from '../models/landing-config.model';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class LandingConfigService {
  constructor(private readonly http: HttpClient) {}

  get(companyId: number): Observable<LandingConfigResponse> {
    return this.http.get<LandingConfigResponse>(
      `${environment.apiUrl}/companies/${companyId}/landing-config`,
    );
  }

  updateLandingConfig(
    companyId: number,
    payload: UpdateLandingConfigPayload,
  ): Observable<LandingConfigResponse> {
    return this.http.put<LandingConfigResponse>(
      `${environment.apiUrl}/companies/${companyId}/landing-config`,
      payload,
    );
  }

  updateCompanyPublicSlug(
    companyId: number,
    publicSlug: string | null,
  ): Observable<LandingConfigResponse> {
    return this.http.put<LandingConfigResponse>(
      `${environment.apiUrl}/companies/${companyId}/public-slug`,
      { publicSlug },
    );
  }

  updateCompanyFallbackUrl(
    companyId: number,
    fallbackAffiliateUrl: string | null,
  ): Observable<LandingConfigResponse> {
    return this.http.put<LandingConfigResponse>(
      `${environment.apiUrl}/companies/${companyId}/fallback-url`,
      { fallbackAffiliateUrl },
    );
  }

  uploadProfileImage(companyId: number, file: File): Observable<LandingConfigResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<LandingConfigResponse>(
      `${environment.apiUrl}/companies/${companyId}/landing-config/profile-image`,
      formData,
    );
  }

  removeProfileImage(companyId: number): Observable<LandingConfigResponse> {
    return this.http.delete<LandingConfigResponse>(
      `${environment.apiUrl}/companies/${companyId}/landing-config/profile-image`,
    );
  }

  updateUserPublicSlug(userId: number, publicSlug: string | null): Observable<{ user: User }> {
    return this.http.put<{ user: User }>(`${environment.apiUrl}/users/${userId}/public-slug`, {
      publicSlug,
    });
  }

  isPublicSlugAvailable(slug: string): Observable<boolean> {
    return this.http.head(`${environment.apiUrl}/public/landing/${encodeURIComponent(slug)}`).pipe(
      map(() => false),
      catchError((error) => {
        if (error?.status === 404) {
          return of(true);
        }

        return throwError(() => error);
      }),
    );
  }
}
