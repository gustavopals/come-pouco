import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachEventTracking, trackEvent } from './analytics';

describe('landing analytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does nothing outside the browser', () => {
    expect(() => trackEvent('cta_click_hero_primary')).not.toThrow();
  });

  it('prefers Umami when available', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { umami: { track } });

    trackEvent('cta_click_pricing_pro', { plan: 'pro' });

    expect(track).toHaveBeenCalledWith('cta_click_pricing_pro', { plan: 'pro' });
  });

  it('uses Plausible when Umami is not available', () => {
    const plausible = vi.fn();
    vi.stubGlobal('window', { plausible });

    trackEvent('lead_form_success', { source: 'form' });

    expect(plausible).toHaveBeenCalledWith('lead_form_success', { props: { source: 'form' } });
  });

  it('tracks clicks from data attributes', () => {
    const track = vi.fn();
    const listeners = new Map<string, (event: { target: unknown }) => void>();
    const target = {
      dataset: {
        event: 'cta_click_header_register',
        eventPropPlan: 'free'
      },
      closest: vi.fn(() => target)
    };

    vi.stubGlobal('window', { umami: { track } });
    vi.stubGlobal('document', {
      addEventListener: vi.fn((event: string, handler: (event: { target: unknown }) => void) => {
        listeners.set(event, handler);
      })
    });

    attachEventTracking();
    listeners.get('click')?.({ target });

    expect(track).toHaveBeenCalledWith('cta_click_header_register', { plan: 'free' });
  });
});
