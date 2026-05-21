import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PublicLandingResponse } from '../models/public-landing.model';
import { PublicAnalyticsService } from '../services/public-analytics.service';
import { PublicConvertService } from '../services/public-convert.service';
import { PublicRedirectService } from '../services/public-redirect.service';
import { PublicHomeComponent } from './public-home.component';

const landing: PublicLandingResponse = {
  company: {
    name: 'Acme',
    publicSlug: 'acme',
  },
  landingConfig: {
    bannerText: 'Ofertas Shopee',
    bannerEmoji: '',
    heroTitle: 'Cole o link',
    heroSubtitle: 'Prepare seu link',
    howItWorksSteps: ['Cole', 'Aplique', 'Compre'],
    primaryColor: '#10b981',
    logoUrl: null,
    isActive: true,
  },
};

type PublicHomeHarness = PublicHomeComponent & {
  convertForm: PublicHomeComponent['convertForm'];
  conversionState: PublicHomeComponent['conversionState'];
  countdownSeconds: PublicHomeComponent['countdownSeconds'];
  submitConversion(): void;
  goToShopeeNow(event?: Event): void;
  retryConversion(): void;
};

describe('PublicHomeComponent', () => {
  let component: PublicHomeHarness;
  let fixture: ReturnType<typeof TestBed.createComponent<PublicHomeComponent>>;
  let publicConvertService: { convert: ReturnType<typeof vi.fn> };
  let publicAnalyticsService: {
    trackConversionView: ReturnType<typeof vi.fn>;
    trackRedirectClick: ReturnType<typeof vi.fn>;
  };
  let publicRedirectService: {
    openInNewTab: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    publicConvertService = { convert: vi.fn() };
    publicAnalyticsService = {
      trackConversionView: vi.fn(),
      trackRedirectClick: vi.fn(),
    };
    publicRedirectService = {
      openInNewTab: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [PublicHomeComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              data: of({ landing }),
            },
            paramMap: of(convertToParamMap({ employeeSlug: 'ana' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        {
          provide: PublicConvertService,
          useValue: publicConvertService,
        },
        {
          provide: PublicAnalyticsService,
          useValue: publicAnalyticsService,
        },
        {
          provide: PublicRedirectService,
          useValue: publicRedirectService,
        },
      ],
    });
    TestBed.overrideComponent(PublicHomeComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(PublicHomeComponent);
    component = fixture.componentInstance as PublicHomeHarness;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('inicia countdown e abre automaticamente em nova aba em sucesso', () => {
    vi.useFakeTimers();
    const affiliateUrl = 'https://s.shopee.com.br/success';
    publicConvertService.convert.mockReturnValue(
      of({ status: 'success', affiliateUrl, conversionId: 'conversion-1' }),
    );
    component.convertForm.setValue({ url: 'https://shopee.com.br/product/1/2', website: '' });

    component.submitConversion();

    expect(component.conversionState()).toBe('success');
    expect(component.countdownSeconds()).toBe(2);
    expect(publicAnalyticsService.trackConversionView).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        companySlug: 'acme',
        employeeSlug: 'ana',
        conversionId: 'conversion-1',
      }),
    );

    vi.advanceTimersByTime(1000);
    expect(component.countdownSeconds()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(component.countdownSeconds()).toBe(0);
    expect(publicAnalyticsService.trackRedirectClick).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        source: 'auto',
        companySlug: 'acme',
        employeeSlug: 'ana',
      }),
    );
    expect(publicRedirectService.openInNewTab).toHaveBeenCalledWith(affiliateUrl);
    vi.useRealTimers();
  });

  it('permite abrir fallback manualmente em nova aba durante countdown', () => {
    const affiliateUrl = 'https://s.shopee.com.br/fallback';
    publicConvertService.convert.mockReturnValue(
      of({ status: 'fallback', affiliateUrl, conversionId: 'conversion-2' }),
    );
    component.convertForm.setValue({ url: 'https://shopee.com.br/product/1/2', website: '' });

    component.submitConversion();
    component.goToShopeeNow(new Event('click'));

    expect(component.conversionState()).toBe('fallback');
    expect(publicAnalyticsService.trackConversionView).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fallback' }),
    );
    expect(publicAnalyticsService.trackRedirectClick).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fallback', source: 'manual' }),
    );
    expect(publicRedirectService.openInNewTab).toHaveBeenCalledWith(affiliateUrl);
  });

  it('mostra erro e reseta o formulario ao tentar novamente', () => {
    publicConvertService.convert.mockReturnValue(throwError(() => new Error('network')));
    component.convertForm.setValue({ url: 'https://shopee.com.br/product/1/2', website: '' });

    component.submitConversion();

    expect(component.conversionState()).toBe('error');
    expect(publicAnalyticsService.trackConversionView).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        companySlug: 'acme',
      }),
    );
    expect(publicRedirectService.openInNewTab).not.toHaveBeenCalled();

    component.retryConversion();

    expect(component.conversionState()).toBe('form');
    expect(component.convertForm.value).toEqual({ url: '', website: '' });
  });
});
