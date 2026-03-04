import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const usersCreateGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (authService.isAdmin()) {
    return true;
  }

  if (authService.isOwner()) {
    return router.createUrlTree(['/my-company']);
  }

  return router.createUrlTree(['/users']);
};
