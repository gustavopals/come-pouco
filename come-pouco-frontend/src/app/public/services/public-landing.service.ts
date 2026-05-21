import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PublicLandingResponse } from '../models/public-landing.model';

interface PublicLandingCacheEntry {
  data: PublicLandingResponse;
  expiresAt: number;
}

const PUBLIC_LANDING_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PublicLandingService {
  private readonly cacheSignal = signal<Record<string, PublicLandingCacheEntry>>({});
  readonly cache = this.cacheSignal.asReadonly();

  constructor(private readonly http: HttpClient) {}

  getLanding(companySlug: string): Observable<PublicLandingResponse> {
    const slug = normalizeSlug(companySlug);
    const cached = this.cacheSignal()[slug];

    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.data);
    }

    return this.http
      .get<PublicLandingResponse>(
        `${environment.apiUrl}/public/landing/${encodeURIComponent(slug)}`,
      )
      .pipe(
        tap((data) => {
          this.cacheSignal.update((cache) => ({
            ...cache,
            [slug]: {
              data,
              expiresAt: Date.now() + PUBLIC_LANDING_CACHE_TTL_MS,
            },
          }));
        }),
      );
  }

  clear(companySlug?: string): void {
    if (!companySlug) {
      this.cacheSignal.set({});
      return;
    }

    const slug = normalizeSlug(companySlug);
    this.cacheSignal.update((cache) => {
      const next = { ...cache };
      delete next[slug];
      return next;
    });
  }
}

const normalizeSlug = (value: string): string => value.trim().toLowerCase();
