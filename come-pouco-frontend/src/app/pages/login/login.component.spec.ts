import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthResponse, AuthUser, LoginResponse } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login.component';

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

type LoginComponentHarness = LoginComponent & {
  loginForm: LoginComponent['loginForm'];
  twoFactorForm: LoginComponent['twoFactorForm'];
  vm$: LoginComponent['vm$'];
  submit(vm: { tempToken: string | null; isSubmitting: boolean }): void;
  backToLogin(): void;
};

describe('LoginComponent', () => {
  let component: LoginComponentHarness;
  let authService: {
    login: ReturnType<
      typeof vi.fn<(identifier: string, password: string) => Observable<LoginResponse>>
    >;
    loginTwoFactor: ReturnType<
      typeof vi.fn<
        (payload: {
          tempToken: string;
          code: string;
          trustDevice?: boolean;
        }) => Observable<AuthResponse>
      >
    >;
    completeLogin: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
      loginTwoFactor: vi.fn(),
      completeLogin: vi.fn(),
    };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideNoopAnimations(),
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
    TestBed.overrideComponent(LoginComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    component = TestBed.createComponent(LoginComponent).componentInstance as LoginComponentHarness;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('marca formulario invalido sem acionar login', () => {
    component.submit({ tempToken: null, isSubmitting: false });

    expect(authService.login).not.toHaveBeenCalled();
    expect(component.loginForm.controls.identifier.touched).toBe(true);
    expect(component.loginForm.controls.password.touched).toBe(true);
  });

  it('completa login sem 2FA e navega para home', async () => {
    const response: AuthResponse = { token: 'jwt-token', user: makeUser() };
    authService.login.mockReturnValue(of(response));
    component.loginForm.setValue({ identifier: 'ana', password: 'secret' });

    component.submit({ tempToken: null, isSubmitting: false });

    expect(authService.login).toHaveBeenCalledWith('ana', 'secret');
    expect(authService.completeLogin).toHaveBeenCalledWith(response);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    await expect(firstValueFrom(component.vm$)).resolves.toMatchObject({
      isSubmitting: false,
      tempToken: null,
      errorMessage: '',
    });
  });

  it('abre desafio 2FA quando backend retorna tempToken', async () => {
    authService.login.mockReturnValue(of({ requires2fa: true, tempToken: 'tmp-token' }));
    component.loginForm.setValue({ identifier: 'ana', password: 'secret' });

    component.submit({ tempToken: null, isSubmitting: false });

    expect(authService.completeLogin).not.toHaveBeenCalled();
    await expect(firstValueFrom(component.vm$)).resolves.toMatchObject({
      isSubmitting: false,
      tempToken: 'tmp-token',
      errorMessage: '',
    });
  });

  it('valida segundo fator, respeita trustDevice e navega', () => {
    const response: AuthResponse = { token: 'jwt-2fa', user: makeUser({ twoFactorEnabled: true }) };
    authService.loginTwoFactor.mockReturnValue(of(response));
    component.twoFactorForm.setValue({ code: '123456', trustDevice: true });

    component.submit({ tempToken: 'tmp-token', isSubmitting: false });

    expect(authService.loginTwoFactor).toHaveBeenCalledWith({
      tempToken: 'tmp-token',
      code: '123456',
      trustDevice: true,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('exibe mensagem amigavel para credenciais invalidas', async () => {
    authService.login.mockReturnValue(
      throwError(() => ({
        error: {
          errorCode: 'AUTH_INVALID_CREDENTIALS',
        },
      })),
    );
    component.loginForm.setValue({ identifier: 'ana', password: 'wrong' });

    component.submit({ tempToken: null, isSubmitting: false });

    await expect(firstValueFrom(component.vm$)).resolves.toMatchObject({
      isSubmitting: false,
      errorMessage: 'Usuario/e-mail ou senha invalidos.',
    });
  });

  it('volta do desafio 2FA para o formulario de senha', async () => {
    authService.login.mockReturnValue(of({ requires2fa: true, tempToken: 'tmp-token' }));
    component.loginForm.setValue({ identifier: 'ana', password: 'secret' });
    component.submit({ tempToken: null, isSubmitting: false });

    component.backToLogin();

    await expect(firstValueFrom(component.vm$)).resolves.toMatchObject({
      tempToken: null,
      errorMessage: '',
    });
    expect(component.twoFactorForm.value).toEqual({ code: '', trustDevice: false });
  });
});
