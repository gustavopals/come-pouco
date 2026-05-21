import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { AuthUser } from '../../core/models/auth.model';
import { LandingConfigResponse } from '../../core/models/landing-config.model';
import { AuthService } from '../../core/services/auth.service';
import { LandingConfigService } from '../../core/services/landing-config.service';
import { UserService } from '../../core/services/user.service';
import { MyCompanyComponent } from './my-company.component';

const makeAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  fullName: 'Ana Silva',
  username: 'ana',
  email: 'ana@example.com',
  role: 'USER',
  companyId: 10,
  companyRole: 'OWNER',
  company: {
    id: 10,
    name: 'Come Pouco',
    shopeeMode: 'TEST',
    isShopeeConfiguredForMode: true,
  },
  twoFactorEnabled: false,
  twoFactorConfirmedAt: null,
  ...overrides,
});

const makeLandingResponse = (
  overrides: Partial<LandingConfigResponse> = {},
): LandingConfigResponse => ({
  company: {
    id: 10,
    name: 'Come Pouco',
    publicSlug: 'come-pouco',
    fallbackAffiliateUrl: 'https://shopee.com.br/come-pouco',
  },
  landingConfig: {
    id: 5,
    companyId: 10,
    bannerText: 'Ofertas selecionadas',
    bannerEmoji: 'CP',
    heroTitle: 'Compre melhor',
    heroSubtitle: 'Links afiliados em um so lugar',
    howItWorksSteps: ['Escolha uma oferta', 'Compre pela Shopee'],
    primaryColor: '#10b981',
    logoUrl: null,
    isActive: true,
    updatedAt: '2026-05-01T10:00:00.000Z',
  },
  ...overrides,
});

type MyCompanyHarness = MyCompanyComponent & {
  employees$: MyCompanyComponent['employees$'];
  landingCompanyName: string;
  landingForm: MyCompanyComponent['landingForm'];
  howItWorksSteps: MyCompanyComponent['howItWorksSteps'];
  slugAvailability$: MyCompanyComponent['slugAvailability$'];
  landingSuccessMessage$: MyCompanyComponent['landingSuccessMessage$'];
  landingErrorMessage$: MyCompanyComponent['landingErrorMessage$'];
  loadLandingConfig(): void;
  saveLandingConfig(): void;
};

describe('MyCompanyComponent', () => {
  let component: MyCompanyHarness;
  let authService: { currentUser: ReturnType<typeof vi.fn<() => AuthUser | null>> };
  let landingConfigService: {
    get: ReturnType<typeof vi.fn>;
    isPublicSlugAvailable: ReturnType<typeof vi.fn>;
    updateCompanyPublicSlug: ReturnType<typeof vi.fn>;
    updateCompanyFallbackUrl: ReturnType<typeof vi.fn>;
    updateLandingConfig: ReturnType<typeof vi.fn>;
    updateUserPublicSlug: ReturnType<typeof vi.fn>;
  };
  let userService: { listAllUsers: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      currentUser: vi.fn<() => AuthUser | null>(() => makeAuthUser()),
    };
    landingConfigService = {
      get: vi.fn(() => of(makeLandingResponse())),
      isPublicSlugAvailable: vi.fn(() => of(true)),
      updateCompanyPublicSlug: vi.fn(() => of({ ok: true })),
      updateCompanyFallbackUrl: vi.fn(() => of({ ok: true })),
      updateLandingConfig: vi.fn(() => of(makeLandingResponse())),
      updateUserPublicSlug: vi.fn(() => of({ ok: true })),
    };
    userService = { listAllUsers: vi.fn(() => of([])) };

    TestBed.configureTestingModule({
      imports: [MyCompanyComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: LandingConfigService,
          useValue: landingConfigService,
        },
        {
          provide: UserService,
          useValue: userService,
        },
      ],
    });
    TestBed.overrideComponent(MyCompanyComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(MyCompanyComponent);
    component = fixture.componentInstance as MyCompanyHarness;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('carrega configuracao da landing da empresa atual', () => {
    expect(landingConfigService.get).toHaveBeenCalledWith(10);
    expect(component.landingCompanyName).toBe('Come Pouco');
    expect(component.landingForm.controls.publicSlug.value).toBe('come-pouco');
    expect(component.howItWorksSteps.length).toBe(2);
    expect(component.slugAvailability$.getValue()).toBe('current');
  });

  it('lista apenas funcionarios na aba equipe', async () => {
    userService.listAllUsers.mockReturnValue(
      of([
        {
          id: 1,
          fullName: 'Dono',
          username: 'dono',
          email: 'dono@example.com',
          role: 'USER',
          companyId: 10,
          companyRole: 'OWNER',
          publicSlug: null,
          twoFactorEnabled: false,
          createdAt: '2026-05-01T10:00:00.000Z',
        },
        {
          id: 2,
          fullName: 'Funcionario',
          username: 'funcionario',
          email: 'funcionario@example.com',
          role: 'USER',
          companyId: 10,
          companyRole: 'EMPLOYEE',
          publicSlug: null,
          twoFactorEnabled: false,
          createdAt: '2026-05-01T10:00:00.000Z',
        },
        {
          id: 3,
          fullName: 'Admin',
          username: 'admin',
          email: 'admin@example.com',
          role: 'ADMIN',
          companyId: null,
          companyRole: null,
          publicSlug: null,
          twoFactorEnabled: false,
          createdAt: '2026-05-01T10:00:00.000Z',
        },
      ]),
    );

    const employees = await firstValueFrom(component.employees$);

    expect(employees.map((user) => user.id)).toEqual([2]);
  });

  it('verifica disponibilidade do slug com debounce', async () => {
    vi.useFakeTimers();

    component.landingForm.controls.publicSlug.setValue('nova-loja');

    await vi.advanceTimersByTimeAsync(300);

    expect(landingConfigService.isPublicSlugAvailable).toHaveBeenCalledWith('nova-loja');
    expect(component.slugAvailability$.getValue()).toBe('available');
  });

  it('salva slug, fallback e conteudo da landing em sequencia', () => {
    const updated = makeLandingResponse({
      company: {
        id: 10,
        name: 'Come Pouco',
        publicSlug: 'nova-loja',
        fallbackAffiliateUrl: 'https://shopee.com.br/nova-loja',
      },
    });
    landingConfigService.updateLandingConfig.mockReturnValue(of(updated));
    component.landingForm.patchValue({
      publicSlug: 'nova-loja',
      fallbackAffiliateUrl: 'https://shopee.com.br/nova-loja',
      isActive: true,
      bannerText: 'Ofertas de hoje',
      bannerEmoji: 'OK',
      heroTitle: 'Achados da semana',
      heroSubtitle: 'Uma vitrine publica de ofertas',
      primaryColor: '#0f766e',
      logoUrl: 'https://cdn.example.test/logo.png',
    });

    component.saveLandingConfig();

    expect(landingConfigService.updateCompanyPublicSlug).toHaveBeenCalledWith(10, 'nova-loja');
    expect(landingConfigService.updateCompanyFallbackUrl).toHaveBeenCalledWith(
      10,
      'https://shopee.com.br/nova-loja',
    );
    expect(landingConfigService.updateLandingConfig).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        bannerText: 'Ofertas de hoje',
        bannerEmoji: 'OK',
        heroTitle: 'Achados da semana',
        heroSubtitle: 'Uma vitrine publica de ofertas',
        primaryColor: '#0f766e',
        logoUrl: 'https://cdn.example.test/logo.png',
        isActive: true,
        howItWorksSteps: ['Escolha uma oferta', 'Compre pela Shopee'],
      }),
    );
    expect(component.landingSuccessMessage$.getValue()).toBe('Landing publica atualizada.');
    expect(component.landingForm.controls.publicSlug.value).toBe('nova-loja');
  });

  it('exige slug e fallback antes de ativar landing publica', () => {
    component.landingForm.patchValue({
      publicSlug: '',
      fallbackAffiliateUrl: '',
      isActive: true,
    });

    component.saveLandingConfig();

    expect(landingConfigService.updateCompanyPublicSlug).not.toHaveBeenCalled();
    expect(component.landingErrorMessage$.getValue()).toBe(null);
    expect(component.landingForm.invalid).toBe(true);
  });
});
