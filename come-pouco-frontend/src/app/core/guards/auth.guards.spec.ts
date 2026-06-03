import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { conversionsGuard } from './conversions.guard';
import { guestGuard } from './guest.guard';
import { noPublicRegisterGuard } from './no-public-register.guard';
import { ownerGuard } from './owner.guard';
import { ownerOrAdminGuard } from './owner-or-admin.guard';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  let authService: {
    isAuthenticated: ReturnType<typeof vi.fn<() => boolean>>;
    isAdmin: ReturnType<typeof vi.fn<() => boolean>>;
    isOwner: ReturnType<typeof vi.fn<() => boolean>>;
    isEmployee: ReturnType<typeof vi.fn<() => boolean>>;
  };

  const runGuard = (guard: CanActivateFn) =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as boolean | UrlTree;

  const expectRedirect = (result: boolean | UrlTree, path: string) => {
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe(path);
  };

  beforeEach(() => {
    authService = {
      isAuthenticated: vi.fn<() => boolean>(() => false),
      isAdmin: vi.fn<() => boolean>(() => false),
      isOwner: vi.fn<() => boolean>(() => false),
      isEmployee: vi.fn<() => boolean>(() => false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });

    TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('authGuard permite usuario autenticado e redireciona visitante', () => {
    expectRedirect(runGuard(authGuard), '/login');

    authService.isAuthenticated.mockReturnValue(true);

    expect(runGuard(authGuard)).toBe(true);
  });

  it('guestGuard bloqueia tela publica para usuario autenticado', () => {
    expect(runGuard(guestGuard)).toBe(true);

    authService.isAuthenticated.mockReturnValue(true);

    expectRedirect(runGuard(guestGuard), '/home');
  });

  it('adminGuard exige login e papel ADMIN', () => {
    expectRedirect(runGuard(adminGuard), '/login');

    authService.isAuthenticated.mockReturnValue(true);
    expectRedirect(runGuard(adminGuard), '/affiliate-links');

    authService.isAdmin.mockReturnValue(true);
    expect(runGuard(adminGuard)).toBe(true);
  });

  it('ownerGuard exige vínculo OWNER', () => {
    authService.isAuthenticated.mockReturnValue(true);
    expectRedirect(runGuard(ownerGuard), '/home');

    authService.isOwner.mockReturnValue(true);
    expect(runGuard(ownerGuard)).toBe(true);
  });

  it('ownerOrAdminGuard libera OWNER ou ADMIN', () => {
    expectRedirect(runGuard(ownerOrAdminGuard), '/login');

    authService.isAuthenticated.mockReturnValue(true);
    expectRedirect(runGuard(ownerOrAdminGuard), '/home');

    authService.isOwner.mockReturnValue(true);
    expect(runGuard(ownerOrAdminGuard)).toBe(true);

    authService.isOwner.mockReturnValue(false);
    authService.isAdmin.mockReturnValue(true);
    expect(runGuard(ownerOrAdminGuard)).toBe(true);
  });

  it('conversionsGuard libera ADMIN, OWNER ou EMPLOYEE', () => {
    expectRedirect(runGuard(conversionsGuard), '/login');

    authService.isAuthenticated.mockReturnValue(true);
    expectRedirect(runGuard(conversionsGuard), '/home');

    authService.isEmployee.mockReturnValue(true);
    expect(runGuard(conversionsGuard)).toBe(true);

    authService.isEmployee.mockReturnValue(false);
    authService.isOwner.mockReturnValue(true);
    expect(runGuard(conversionsGuard)).toBe(true);

    authService.isOwner.mockReturnValue(false);
    authService.isAdmin.mockReturnValue(true);
    expect(runGuard(conversionsGuard)).toBe(true);
  });

  it('noPublicRegisterGuard libera admin e redireciona usuarios comuns', () => {
    authService.isAuthenticated.mockReturnValue(true);
    expectRedirect(runGuard(noPublicRegisterGuard), '/home');

    authService.isAdmin.mockReturnValue(true);
    expect(runGuard(noPublicRegisterGuard)).toBe(true);
  });
});
