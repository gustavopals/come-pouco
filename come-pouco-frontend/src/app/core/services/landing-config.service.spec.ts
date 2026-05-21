import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { LandingConfigResponse } from '../models/landing-config.model';
import { LandingConfigService } from './landing-config.service';

const makeResponse = (): LandingConfigResponse => ({
  company: {
    id: 10,
    name: 'Come Pouco',
    publicSlug: 'come-pouco',
    fallbackAffiliateUrl: 'https://shopee.com.br/come-pouco',
  },
  landingConfig: {
    id: 5,
    companyId: 10,
    bannerText: 'Ofertas',
    bannerEmoji: 'CP',
    heroTitle: 'Achados',
    heroSubtitle: 'Curadoria',
    howItWorksSteps: ['Cole', 'Compre'],
    primaryColor: '#10b981',
    logoUrl: null,
    isActive: true,
    updatedAt: '2026-05-01T10:00:00.000Z',
  },
});

describe('LandingConfigService', () => {
  let service: LandingConfigService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LandingConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('le e atualiza configuracao publica da empresa', () => {
    service.get(10).subscribe();
    let req = http.expectOne(`${environment.apiUrl}/companies/10/landing-config`);
    expect(req.request.method).toBe('GET');
    req.flush(makeResponse());

    service.updateLandingConfig(10, { bannerText: 'Novas ofertas', isActive: false }).subscribe();
    req = http.expectOne(`${environment.apiUrl}/companies/10/landing-config`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ bannerText: 'Novas ofertas', isActive: false });
    req.flush(makeResponse());
  });

  it('atualiza slug publico, fallback e slug de usuario', () => {
    service.updateCompanyPublicSlug(10, 'nova-loja').subscribe();
    let req = http.expectOne(`${environment.apiUrl}/companies/10/public-slug`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ publicSlug: 'nova-loja' });
    req.flush(makeResponse());

    service.updateCompanyFallbackUrl(10, null).subscribe();
    req = http.expectOne(`${environment.apiUrl}/companies/10/fallback-url`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fallbackAffiliateUrl: null });
    req.flush(makeResponse());

    service.updateUserPublicSlug(7, 'ana-ofertas').subscribe();
    req = http.expectOne(`${environment.apiUrl}/users/7/public-slug`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ publicSlug: 'ana-ofertas' });
    req.flush({ user: { id: 7 } });
  });

  it('interpreta HEAD de slug publico como indisponivel quando existe', () => {
    let available: boolean | undefined;

    service.isPublicSlugAvailable('come-pouco').subscribe((value) => {
      available = value;
    });

    const req = http.expectOne(`${environment.apiUrl}/public/landing/come-pouco`);
    expect(req.request.method).toBe('HEAD');
    req.flush(null);

    expect(available).toBe(false);
  });

  it('interpreta 404 no HEAD de slug publico como disponivel', () => {
    let available: boolean | undefined;

    service.isPublicSlugAvailable('nova-loja').subscribe((value) => {
      available = value;
    });

    const req = http.expectOne(`${environment.apiUrl}/public/landing/nova-loja`);
    req.flush(null, { status: 404, statusText: 'Not Found' });

    expect(available).toBe(true);
  });
});
