import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let authService: {
    getToken: ReturnType<typeof vi.fn<() => string | null>>;
    isAuthenticated: ReturnType<typeof vi.fn<() => boolean>>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      getToken: vi.fn<() => string | null>(() => null),
      isAuthenticated: vi.fn<() => boolean>(() => false),
      clearSession: vi.fn(),
    };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    });

    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('anexa bearer token e credenciais em chamadas privadas da API', () => {
    authService.getToken.mockReturnValue('jwt-token');

    client.get('/api/affiliate-links').subscribe();

    const req = http.expectOne('/api/affiliate-links');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.withCredentials).toBe(true);

    req.flush({ ok: true });
  });

  it('mantem chamadas publicas da API sem cabecalhos de autenticacao', () => {
    authService.getToken.mockReturnValue('jwt-token');

    client.get('/api/public/landing/acme').subscribe();

    const req = http.expectOne('/api/public/landing/acme');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(false);

    req.flush({ ok: true });
  });

  it('nao altera chamadas fora da API local', () => {
    authService.getToken.mockReturnValue('jwt-token');

    client.get('https://cdn.example.test/asset.json').subscribe();

    const req = http.expectOne('https://cdn.example.test/asset.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(false);

    req.flush({ ok: true });
  });

  it('limpa sessao e redireciona quando token autenticado expira', () => {
    authService.getToken.mockReturnValue('jwt-token');
    authService.isAuthenticated.mockReturnValue(true);
    let receivedStatus = 0;

    client.get('/api/affiliate-links').subscribe({
      error: (error: { status: number }) => {
        receivedStatus = error.status;
      },
    });

    const req = http.expectOne('/api/affiliate-links');
    req.flush({ errorCode: 'AUTH_TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    expect(receivedStatus).toBe(401);
    expect(authService.clearSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('preserva fluxo de autenticacao quando a falha vem de endpoint de login', () => {
    authService.getToken.mockReturnValue('jwt-token');
    authService.isAuthenticated.mockReturnValue(true);

    client.post('/api/auth/login', { identifier: 'ana', password: 'secret' }).subscribe({
      error: () => undefined,
    });

    const req = http.expectOne('/api/auth/login');
    req.flush({ errorCode: 'AUTH_TOKEN_INVALID' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
