import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiErrorResponse } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  const isApiRequest = req.url.startsWith(environment.apiUrl);

  const requestWithToken = isApiRequest
    ? req.clone({
        withCredentials: true,
        setHeaders: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      })
    : req;

  return next(requestWithToken).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorPayload = (error?.error || {}) as ApiErrorResponse;
      const code = String(errorPayload.errorCode || '');
      const isTokenError = code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_TOKEN_INVALID';
      const isAuthSetupEndpoint =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/login/2fa') ||
        req.url.includes('/auth/2fa/verify') ||
        req.url.includes('/auth/2fa/disable') ||
        req.url.includes('/auth/2fa/enable') ||
        req.url.includes('/auth/2fa/confirm') ||
        req.url.includes('/auth/2fa/setup');

      if ((error.status === 401 || error.status === 403) && authService.isAuthenticated() && isTokenError && !isAuthSetupEndpoint) {
        authService.clearSession();
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
