import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { PurchasePlatform } from '../models/purchase-platform.model';
import { PurchasePlatformService } from './purchase-platform.service';

const makePlatform = (overrides: Partial<PurchasePlatform> = {}): PurchasePlatform => ({
  id: 1,
  name: 'Shopee Test',
  description: 'Ambiente de teste',
  type: 'SHOPEE',
  appId: 'app-id',
  secretConfigured: true,
  isActive: true,
  mockMode: true,
  apiUrl: 'https://partner.test',
  apiLink: 'https://partner.test/graphql',
  accessKey: 'access',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  ...overrides,
});

describe('PurchasePlatformService', () => {
  let service: PurchasePlatformService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PurchasePlatformService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('lista plataformas com paginacao e agrega listAll', () => {
    service.list({ page: 2, limit: 10 }).subscribe();

    let req = http.expectOne(
      (request) => request.url === `${environment.apiUrl}/purchase-platforms`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({
      platforms: [makePlatform()],
      items: [],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });

    let received: PurchasePlatform[] = [];
    service.listAll().subscribe((platforms) => {
      received = platforms;
    });

    req = http.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/purchase-platforms` &&
        request.params.get('page') === '1',
    );
    req.flush({
      platforms: [makePlatform({ id: 1 })],
      items: [],
      meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
    });

    req = http.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/purchase-platforms` &&
        request.params.get('page') === '2',
    );
    req.flush({
      platforms: [makePlatform({ id: 2, name: 'Shopee Prod' })],
      items: [],
      meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
    });

    expect(received.map((platform) => platform.id)).toEqual([1, 2]);
  });

  it('cria, atualiza, vincula empresas e remove plataformas', () => {
    const payload = {
      name: 'Shopee',
      description: 'Marketplace',
      type: 'SHOPEE' as const,
      appId: 'app-id',
      secret: 'secret',
      isActive: true,
      mockMode: false,
      apiUrl: 'https://partner.shopeemobile.com',
      apiLink: 'https://partner.shopeemobile.com/api/v2/graphql',
      accessKey: 'access',
    };

    service.create(payload).subscribe();
    let req = http.expectOne(`${environment.apiUrl}/purchase-platforms`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ platform: makePlatform() });

    service.update(1, { isActive: false }).subscribe();
    req = http.expectOne(`${environment.apiUrl}/purchase-platforms/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ isActive: false });
    req.flush({ platform: makePlatform({ isActive: false }) });

    service.listCompanies(1).subscribe();
    req = http.expectOne(`${environment.apiUrl}/purchase-platforms/1/companies`);
    expect(req.request.method).toBe('GET');
    req.flush({
      companies: [
        {
          companyId: 10,
          companyName: 'auralinks',
          isDefaultForCompany: true,
          createdAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    service.updateCompanies(1, { companyIds: [10], defaultCompanyIds: [10] }).subscribe();
    req = http.expectOne(`${environment.apiUrl}/purchase-platforms/1/companies`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ companyIds: [10], defaultCompanyIds: [10] });
    req.flush({ companies: [] });

    service.delete(1).subscribe();
    req = http.expectOne(`${environment.apiUrl}/purchase-platforms/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('consulta e limpa logs de uso de API com filtros opcionais', () => {
    service
      .getApiUsage({
        companyId: 10,
        userId: 7,
        startDate: '2026-05-01',
        endDate: '2026-05-21',
        mode: 'MOCK',
        page: 2,
        limit: 50,
      })
      .subscribe();

    let req = http.expectOne((request) => request.url === `${environment.apiUrl}/admin/api-usage`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('companyId')).toBe('10');
    expect(req.request.params.get('userId')).toBe('7');
    expect(req.request.params.get('startDate')).toBe('2026-05-01');
    expect(req.request.params.get('endDate')).toBe('2026-05-21');
    expect(req.request.params.get('mode')).toBe('MOCK');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ totalMock: 1, totalReal: 0, totalGeral: 1 });

    service
      .deleteMockApiUsage({ companyId: 10, startDate: '2026-05-01', endDate: '2026-05-21' })
      .subscribe();
    req = http.expectOne((request) => request.url === `${environment.apiUrl}/admin/api-usage/mock`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('companyId')).toBe('10');
    expect(req.request.params.get('startDate')).toBe('2026-05-01');
    expect(req.request.params.get('endDate')).toBe('2026-05-21');
    req.flush({ deletedCount: 1 });
  });
});
