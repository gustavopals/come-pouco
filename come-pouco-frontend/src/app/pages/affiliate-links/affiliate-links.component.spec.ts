import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AffiliateLink } from '../../core/models/affiliate-link.model';
import { AuthUser } from '../../core/models/auth.model';
import { PurchasePlatform } from '../../core/models/purchase-platform.model';
import { User } from '../../core/models/user.model';
import { AffiliateLinkService } from '../../core/services/affiliate-link.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchasePlatformService } from '../../core/services/purchase-platform.service';
import { UserService } from '../../core/services/user.service';
import { AffiliateLinksComponent } from './affiliate-links.component';
import { AffiliateLinksResultsDialogComponent } from './affiliate-links-results-dialog.component';

const makeAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  fullName: 'Ana Silva',
  username: 'ana.silva',
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

const makeLink = (overrides: Partial<AffiliateLink> = {}): AffiliateLink => ({
  id: 1,
  originalLink: 'https://shopee.com.br/produto',
  productImage: '',
  catchyPhrase: '',
  affiliateLink: 'https://s.shopee.com.br/abc',
  companyId: 10,
  createdByUserId: 1,
  createdByUser: {
    id: 1,
    fullName: 'Ana Silva',
    email: 'ana@example.com',
  },
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  ...overrides,
});

const makePlatform = (): PurchasePlatform => ({
  id: 99,
  name: 'Shopee Test',
  description: 'Ambiente de teste',
  type: 'SHOPEE',
  appId: '123',
  secretConfigured: true,
  isActive: true,
  mockMode: true,
  apiUrl: 'https://partner.test',
  apiLink: 'https://partner.test/graphql',
  accessKey: 'key',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
});

type AffiliateLinksHarness = AffiliateLinksComponent & {
  form: AffiliateLinksComponent['form'];
  links$: AffiliateLinksComponent['links$'];
  totalLinks$: AffiliateLinksComponent['totalLinks$'];
  processingResults$: AffiliateLinksComponent['processingResults$'];
  errorMessage$: AffiliateLinksComponent['errorMessage$'];
  successMessage$: AffiliateLinksComponent['successMessage$'];
  isSaving$: AffiliateLinksComponent['isSaving$'];
  submit(): void;
  remove(link: AffiliateLink): void;
};

describe('AffiliateLinksComponent', () => {
  let component: AffiliateLinksHarness;
  let affiliateLinkService: {
    list: ReturnType<typeof vi.fn>;
    generateShopeeShortLinks: ReturnType<typeof vi.fn>;
    createFromGenerated: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    clearAll: ReturnType<typeof vi.fn>;
  };
  let authService: {
    me: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn<() => AuthUser | null>>;
    isOwner: ReturnType<typeof vi.fn<() => boolean>>;
    isAdmin: ReturnType<typeof vi.fn<() => boolean>>;
  };
  let purchasePlatformService: { listAll: ReturnType<typeof vi.fn> };
  let userService: { listAllUsers: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    affiliateLinkService = {
      list: vi.fn(() => of({ links: [], meta: { total: 0 } })),
      generateShopeeShortLinks: vi.fn(),
      createFromGenerated: vi.fn(),
      delete: vi.fn(),
      clearAll: vi.fn(),
    };
    authService = {
      me: vi.fn(() => of({ user: makeAuthUser() })),
      currentUser: vi.fn<() => AuthUser | null>(() => makeAuthUser()),
      isOwner: vi.fn<() => boolean>(() => true),
      isAdmin: vi.fn<() => boolean>(() => false),
    };
    purchasePlatformService = { listAll: vi.fn(() => of([makePlatform()])) };
    userService = { listAllUsers: vi.fn(() => of([] as User[])) };
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AffiliateLinksComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: AffiliateLinkService,
          useValue: affiliateLinkService,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: PurchasePlatformService,
          useValue: purchasePlatformService,
        },
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: MatDialog,
          useValue: dialog,
        },
        {
          provide: MatSnackBar,
          useValue: snackBar,
        },
      ],
    });
    TestBed.overrideComponent(AffiliateLinksComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(AffiliateLinksComponent);
    component = fixture.componentInstance as AffiliateLinksHarness;
    (component as unknown as { dialog: typeof dialog }).dialog = dialog;
    (component as unknown as { snackBar: typeof snackBar }).snackBar = snackBar;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('carrega historico paginado e atualiza total', () => {
    const links = [makeLink()];
    affiliateLinkService.list.mockReturnValue(of({ links, meta: { total: 1 } }));
    let received: AffiliateLink[] = [];

    component.links$.subscribe((items: AffiliateLink[]) => {
      received = items;
    });

    expect(affiliateLinkService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
      }),
    );
    expect(received).toEqual(links);
    expect(component.totalLinks$.getValue()).toBe(1);
  });

  it('gera shortlinks Shopee, salva sucessos e abre dialogo de resultados', () => {
    const originUrl = 'https://shopee.com.br/produto-1';
    const failedUrl = 'https://example.com/produto-2';
    affiliateLinkService.generateShopeeShortLinks.mockReturnValue(
      of({
        results: [
          { originUrl, success: true, shortLink: 'https://s.shopee.com.br/abc' },
          { originUrl: failedUrl, success: false, error: 'URL nao elegivel' },
        ],
      }),
    );
    affiliateLinkService.createFromGenerated.mockReturnValue(
      of({ links: [makeLink({ originalLink: originUrl })] }),
    );

    component.form.patchValue({ useAutoSubId1: false });
    component.form.controls.subId1.setValue('campanha_1');
    component.form.controls.originalLinksText.setValue(`${originUrl}\n${failedUrl}`);
    component.form.controls.platformId.setValue(null);

    component.submit();

    expect(affiliateLinkService.generateShopeeShortLinks).toHaveBeenCalledWith({
      originUrls: [originUrl, failedUrl],
      subId1: 'campanha_1',
    });
    expect(affiliateLinkService.createFromGenerated).toHaveBeenCalledWith({
      generatedLinks: [{ originUrl, shortLink: 'https://s.shopee.com.br/abc' }],
      subId1: 'campanha_1',
    });
    expect(component.isSaving$.getValue()).toBe(false);
    expect(component.successMessage$.getValue()).toContain('1 link(s) salvo(s) com sucesso.');
    expect(component.processingResults$.getValue()).toHaveLength(2);
    expect(dialog.open).toHaveBeenCalledWith(
      AffiliateLinksResultsDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          results: expect.any(Array),
        }),
      }),
    );
  });

  it('exige plataforma Shopee quando usuario e admin', () => {
    authService.isAdmin.mockReturnValue(true);
    component.form.setValue({
      originalLinksText: 'https://shopee.com.br/produto-1',
      subId1: '',
      platformId: null,
      useAutoSubId1: false,
    });

    component.submit();

    expect(affiliateLinkService.generateShopeeShortLinks).not.toHaveBeenCalled();
    expect(component.errorMessage$.getValue()).toBe(
      'Selecione uma plataforma SHOPEE para gerar links.',
    );
  });

  it('traduz falha de credenciais Shopee para mensagem acionavel', () => {
    affiliateLinkService.generateShopeeShortLinks.mockReturnValue(
      throwError(() => ({ error: { message: 'credenciais invalidas: secret ausente' } })),
    );
    component.form.setValue({
      originalLinksText: 'https://shopee.com.br/produto-1',
      subId1: '',
      platformId: null,
      useAutoSubId1: false,
    });

    component.submit();

    expect(component.isSaving$.getValue()).toBe(false);
    expect(component.errorMessage$.getValue()).toBe(
      'A plataforma Shopee esta sem credenciais validas. Um ADMIN precisa cadastrar App ID e Secret.',
    );
  });

  it('remove link apos confirmacao', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    affiliateLinkService.delete.mockReturnValue(of(undefined));

    component.remove(makeLink({ id: 42 }));

    expect(confirmSpy).toHaveBeenCalledWith('Excluir o registro #42?');
    expect(affiliateLinkService.delete).toHaveBeenCalledWith(42);
    expect(component.successMessage$.getValue()).toBe('Registro #42 removido com sucesso.');
  });
});
