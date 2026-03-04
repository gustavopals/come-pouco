import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse, AuthUser, LoginResponse, RegisterPayload, TrustedDevice, TwoFactorSetupResponse } from '../models/auth.model';
import type { CompanyRole } from '../models/company-role.model';
import type { UserRole } from '../models/user-role.model';

const TOKEN_KEY = 'come_pouco_token';
const USER_KEY = 'come_pouco_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<AuthUser | null>(this.getStoredUser());

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  get currentUser() {
    return this.currentUserSignal.asReadonly();
  }

  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.apiUrl}/auth/login`,
      { identifier, password },
      { withCredentials: true }
    );
  }

  loginTwoFactor(payload: { tempToken: string; code: string; trustDevice?: boolean }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login/2fa`, payload, { withCredentials: true })
      .pipe(tap((response) => this.setSession(response)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(tap((response) => this.setSession(response)));
  }

  me(): Observable<{ user: AuthUser }> {
    return this.http.get<{ user: AuthUser }>(`${environment.apiUrl}/auth/me`).pipe(
      tap(({ user }) => {
        this.currentUserSignal.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  setupTwoFactor(): Observable<TwoFactorSetupResponse> {
    return this.http.post<TwoFactorSetupResponse>(`${environment.apiUrl}/auth/2fa/setup`, {});
  }

  confirmTwoFactor(code: string): Observable<{ backupCodes: string[] }> {
    return this.http.post<{ backupCodes: string[] }>(`${environment.apiUrl}/auth/2fa/confirm`, { code });
  }

  disableTwoFactor(password: string, code: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${environment.apiUrl}/auth/2fa/disable`, { password, code }, { withCredentials: true });
  }

  listTrustedDevices(): Observable<{ devices: TrustedDevice[] }> {
    return this.http.get<{ devices: TrustedDevice[] }>(`${environment.apiUrl}/auth/trusted-devices`);
  }

  revokeTrustedDevice(deviceId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/auth/trusted-devices/${deviceId}`, { withCredentials: true });
  }

  completeLogin(response: AuthResponse): void {
    this.setSession(response);
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserSignal()?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('ADMIN');
  }

  isOwner(): boolean {
    return this.currentUserSignal()?.companyRole === 'OWNER';
  }

  isEmployee(): boolean {
    return this.currentUserSignal()?.companyRole === 'EMPLOYEE';
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSignal.set(null);
  }

  private setSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }

  private getStoredUser(): AuthUser | null {
    const stored = localStorage.getItem(USER_KEY);

    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<AuthUser>;

      const validRole = parsed?.role === 'ADMIN' || parsed?.role === 'USER';
      const validCompanyRole =
        parsed?.companyRole === null ||
        parsed?.companyRole === undefined ||
        parsed?.companyRole === 'OWNER' ||
        parsed?.companyRole === 'EMPLOYEE';

      if (!parsed || !validRole || !validCompanyRole) {
        localStorage.removeItem(USER_KEY);
        return null;
      }

      return {
        id: Number(parsed.id),
        fullName: String(parsed.fullName || ''),
        username: String(parsed.username || ''),
        email: parsed.email ? String(parsed.email) : null,
        role: parsed.role as UserRole,
        companyId: parsed.companyId === null || parsed.companyId === undefined ? null : Number(parsed.companyId),
        companyRole: (parsed.companyRole ?? null) as CompanyRole | null,
        company:
          parsed.company && typeof parsed.company === 'object'
            ? {
                id: Number((parsed.company as { id?: number }).id),
                name: String((parsed.company as { name?: string }).name || ''),
                shopeeMode: (parsed.company as { shopeeMode?: 'TEST' | 'PROD' }).shopeeMode === 'PROD' ? 'PROD' : 'TEST',
                isShopeeConfiguredForMode: Boolean(
                  (parsed.company as { isShopeeConfiguredForMode?: boolean }).isShopeeConfiguredForMode
                )
              }
            : null,
        twoFactorEnabled: Boolean(parsed.twoFactorEnabled),
        twoFactorConfirmedAt: parsed.twoFactorConfirmedAt ? String(parsed.twoFactorConfirmedAt) : null
      };
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
