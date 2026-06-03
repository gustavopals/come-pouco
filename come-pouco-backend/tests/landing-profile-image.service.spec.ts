import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fs: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn()
  },
  getLandingConfig: vi.fn(),
  updateLandingConfig: vi.fn()
}));

vi.mock('fs', () => ({
  promises: mocks.fs
}));

vi.mock('../src/config/env', () => ({
  default: {
    publicApiUrl: 'https://api.example.test/api',
    uploads: {
      dir: '/tmp/come-pouco-uploads',
      landingLogosSubdir: 'landing-logos'
    }
  }
}));

vi.mock('../src/services/landing-config.service', () => ({
  getLandingConfig: mocks.getLandingConfig,
  updateLandingConfig: mocks.updateLandingConfig
}));

import {
  buildPublicProfileImageUrl,
  uploadLandingProfileImage
} from '../src/services/landing-profile-image.service';

const ownerScope = {
  requesterRole: 'USER' as const,
  requesterCompanyId: 10,
  requesterCompanyRole: 'OWNER' as const
};

const landingResponse = {
  company: {
    id: 10,
    name: 'Loja',
    publicSlug: 'loja',
    fallbackAffiliateUrl: 'https://shopee.com.br/fallback'
  },
  landingConfig: {
    id: 1,
    companyId: 10,
    bannerText: 'Banner',
    bannerEmoji: '🛍️',
    heroTitle: 'Titulo',
    heroSubtitle: 'Subtitulo',
    howItWorksSteps: ['Passo'],
    primaryColor: '#10b981',
    logoUrl: null,
    isActive: true,
    updatedAt: '2026-06-03T12:00:00.000Z'
  }
};

describe('landing-profile-image.service', () => {
  beforeEach(() => {
    mocks.getLandingConfig.mockResolvedValue({
      ...landingResponse,
      landingConfig: { ...landingResponse.landingConfig, logoUrl: null }
    });
    mocks.updateLandingConfig.mockResolvedValue({
      ...landingResponse,
      landingConfig: {
        ...landingResponse.landingConfig,
        logoUrl: buildPublicProfileImageUrl('company-10.png')
      }
    });
    mocks.fs.mkdir.mockResolvedValue(undefined);
    mocks.fs.writeFile.mockResolvedValue(undefined);
    mocks.fs.unlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores the uploaded image and updates landing logoUrl', async () => {
    const result = await uploadLandingProfileImage(
      10,
      {
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/png',
        originalname: 'perfil.png'
      },
      ownerScope
    );

    expect(mocks.fs.writeFile).toHaveBeenCalled();
    expect(mocks.updateLandingConfig).toHaveBeenCalledWith(
      10,
      {
        logoUrl: 'https://api.example.test/api/public/uploads/landing-logos/company-10.png'
      },
      ownerScope
    );
    expect(result.landingConfig.logoUrl).toContain('company-10.png');
  });
});
