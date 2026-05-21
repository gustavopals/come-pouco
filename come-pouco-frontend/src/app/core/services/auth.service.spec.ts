import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthResponse, AuthUser } from '../models/auth.model';
import { AuthService } from './auth.service';

const USER_KEY = 'come_pouco_user';

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  fullName: 'Ana Silva',
  username: 'ana',
  email: 'ana@example.com',
  role: 'USER',
  companyId: 10,
  companyRole: 'OWNER',
  company: {
    id: 10,
    name: 'auralinks',
    shopeeMode: 'TEST',
    isShopeeConfiguredForMode: true,
  },
  twoFactorEnabled: false,
  twoFactorConfirmedAt: null,
  ...overrides,
});

describe('AuthService', () => {
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let service: AuthService;

  const configureService = () => {
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: router,
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
  };

  afterEach(() => {
    http?.verify();
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('hidrata o usuario salvo e normaliza campos persistidos', () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        ...makeUser(),
        id: '7',
        companyId: '99',
        company: {
          id: '99',
          name: 'Acme',
          shopeeMode: 'PROD',
          isShopeeConfiguredForMode: 1,
        },
      }),
    );

    configureService();

    expect(service.currentUser()).toEqual({
      ...makeUser({
        id: 7,
        companyId: 99,
        company: {
          id: 99,
          name: 'Acme',
          shopeeMode: 'PROD',
          isShopeeConfiguredForMode: true,
        },
      }),
    });
  });

  it('remove usuario persistido invalido', () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ ...makeUser(), role: 'ROOT' }));

    configureService();

    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('envia login com credenciais sem persistir sessao automaticamente', () => {
    configureService();
    const response: AuthResponse = { token: 'jwt-token', user: makeUser() };
    let received: AuthResponse | undefined;

    service.login('ana', 'secret').subscribe((value) => {
      received = value as AuthResponse;
    });

    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ identifier: 'ana', password: 'secret' });

    req.flush(response);

    expect(received).toEqual(response);
    expect(service.getToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('persiste sessao ao concluir segundo fator', () => {
    configureService();
    const response: AuthResponse = { token: 'jwt-2fa', user: makeUser({ twoFactorEnabled: true }) };

    service.loginTwoFactor({ tempToken: 'tmp', code: '123456', trustDevice: true }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/login/2fa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ tempToken: 'tmp', code: '123456', trustDevice: true });

    req.flush(response);

    expect(service.getToken()).toBe('jwt-2fa');
    expect(service.currentUser()).toEqual(response.user);
    expect(JSON.parse(localStorage.getItem(USER_KEY) || '{}')).toEqual(response.user);
  });

  it('atualiza o usuario corrente ao buscar /me', () => {
    configureService();
    const user = makeUser({ fullName: 'Ana Atualizada', companyRole: 'EMPLOYEE' });

    service.me().subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('GET');

    req.flush({ user });

    expect(service.currentUser()).toEqual(user);
    expect(JSON.parse(localStorage.getItem(USER_KEY) || '{}')).toEqual(user);
  });

  it('limpa sessao e redireciona no logout', () => {
    configureService();
    const user = makeUser({ role: 'ADMIN' });

    service.completeLogin({ token: 'jwt-admin', user });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAdmin()).toBe(true);

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('expõe helpers de papel e vínculo com empresa', () => {
    configureService();

    service.completeLogin({
      token: 'jwt-owner',
      user: makeUser({ role: 'ADMIN', companyRole: 'OWNER' }),
    });

    expect(service.hasRole('ADMIN')).toBe(true);
    expect(service.isAdmin()).toBe(true);
    expect(service.isOwner()).toBe(true);
    expect(service.isEmployee()).toBe(false);

    service.completeLogin({
      token: 'jwt-employee',
      user: makeUser({ role: 'USER', companyRole: 'EMPLOYEE' }),
    });

    expect(service.isAdmin()).toBe(false);
    expect(service.isOwner()).toBe(false);
    expect(service.isEmployee()).toBe(true);
  });
});
