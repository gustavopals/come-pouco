import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { catchError, of, throwError } from 'rxjs';

import { PublicLandingResponse } from '../models/public-landing.model';
import { PublicLandingService } from '../services/public-landing.service';

export const publicLandingResolver: ResolveFn<PublicLandingResponse | RedirectCommand> = (
  route,
) => {
  const router = inject(Router);
  const publicLandingService = inject(PublicLandingService);
  const companySlug =
    route.parent?.paramMap.get('companySlug') || route.paramMap.get('companySlug') || '';

  return publicLandingService.getLanding(companySlug).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) {
        return of(new RedirectCommand(router.parseUrl('/public-not-found')));
      }

      return throwError(() => error);
    }),
  );
};
