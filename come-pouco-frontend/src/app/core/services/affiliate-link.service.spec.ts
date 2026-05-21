import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AffiliateLink } from '../models/affiliate-link.model';
import { AffiliateLinkService } from './affiliate-link.service';

const makeLink = (overrides: Partial<AffiliateLink> = {}): AffiliateLink => ({
  id: 1,
  originalLink: 'https://shopee.com.br/produto',
  productImage: '',
  catchyPhrase: '',
  affiliateLink: 'https://s.shopee.com.br/abc',
  companyId: 10,
  createdByUserId: 1,
  createdByUser: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  ...overrides,
});

describe('AffiliateLinkService', () => {
  let service: AffiliateLinkService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AffiliateLinkService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('lista links com filtros e paginacao', () => {
    service
      .list({
        page: 2,
        limit: 25,
        search: '  shopee  ',
        createdByUserId: 7,
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-21T23:59:59.999Z',
      })
      .subscribe();

    const req = http.expectOne(
      (request) => request.url === `${environment.apiUrl}/affiliate-links`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('search')).toBe('shopee');
    expect(req.request.params.get('createdByUserId')).toBe('7');
    expect(req.request.params.get('startDate')).toBe('2026-05-01T00:00:00.000Z');
    expect(req.request.params.get('endDate')).toBe('2026-05-21T23:59:59.999Z');

    req.flush({
      links: [makeLink()],
      items: [makeLink()],
      meta: { page: 2, limit: 25, total: 1, totalPages: 1 },
    });
  });

  it('cria, gera e atualiza links por endpoints corretos', () => {
    const link = makeLink();

    service
      .create({
        originalLinks: [link.originalLink],
        subId1: 'ana',
        affiliateLink: link.affiliateLink,
      })
      .subscribe();
    let req = http.expectOne(`${environment.apiUrl}/affiliate-links`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      originalLinks: [link.originalLink],
      subId1: 'ana',
      affiliateLink: link.affiliateLink,
    });
    req.flush({ links: [link] });

    service
      .generateShopeeShortLinks({ originUrls: [link.originalLink], subId1: 'ana', platformId: 99 })
      .subscribe();
    req = http.expectOne(`${environment.apiUrl}/integrations/shopee/generate-shortlinks`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      originUrls: [link.originalLink],
      subId1: 'ana',
      platformId: 99,
    });
    req.flush({
      results: [{ originUrl: link.originalLink, success: true, shortLink: link.affiliateLink }],
    });

    service
      .createFromGenerated({
        generatedLinks: [{ originUrl: link.originalLink, shortLink: link.affiliateLink }],
        subId1: null,
      })
      .subscribe();
    req = http.expectOne(`${environment.apiUrl}/affiliate-links`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      generatedLinks: [{ originUrl: link.originalLink, shortLink: link.affiliateLink }],
      subId1: null,
    });
    req.flush({ links: [link] });

    service.update(1, { catchyPhrase: 'Oferta' }).subscribe();
    req = http.expectOne(`${environment.apiUrl}/affiliate-links/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ catchyPhrase: 'Oferta' });
    req.flush({ link: makeLink({ catchyPhrase: 'Oferta' }) });
  });

  it('remove link e limpa historico com companyId opcional', () => {
    service.delete(1).subscribe();
    let req = http.expectOne(`${environment.apiUrl}/affiliate-links/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    service.clearAll().subscribe();
    req = http.expectOne(`${environment.apiUrl}/affiliate-links`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deletedCount: 2 });

    service.clearAll(10).subscribe();
    req = http.expectOne(
      (request) => request.urlWithParams === `${environment.apiUrl}/affiliate-links?companyId=10`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ deletedCount: 1 });
  });
});
