type EventName =
  | 'cta_click_hero_primary'
  | 'cta_click_hero_secondary'
  | 'cta_click_pricing_free'
  | 'cta_click_pricing_pro'
  | 'cta_click_pricing_enterprise'
  | 'cta_click_final'
  | 'cta_click_header_register'
  | 'cta_click_mobile_register'
  | 'lead_form_submit'
  | 'lead_form_success'
  | 'lead_form_error'
  | 'alli_demo_interact'
  | 'pricing_toggle_yearly'
  | 'faq_expand';

type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    umami?: { track: (name: string, props?: EventProps) => void };
    plausible?: (name: string, options?: { props?: EventProps }) => void;
  }
}

export function trackEvent(name: EventName, props?: EventProps): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.umami?.track === 'function') {
      window.umami.track(name, props);
      return;
    }
    if (typeof window.plausible === 'function') {
      window.plausible(name, props ? { props } : undefined);
      return;
    }
    if (import.meta.env.DEV) {
      console.info('[analytics]', name, props);
    }
  } catch (_e) {
    /* nunca quebrar UX por causa de analytics */
  }
}

/**
 * Auto-instrumentação de elementos com `data-event="<EventName>"`.
 * Importar e chamar `attachEventTracking()` uma vez no boot.
 */
export function attachEventTracking(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-event]');
    if (!target) return;
    const name = target.dataset.event as EventName | undefined;
    if (!name) return;
    const props: EventProps = {};
    Object.entries(target.dataset).forEach(([k, v]) => {
      if (k.startsWith('eventProp')) {
        const key = k.replace('eventProp', '').toLowerCase();
        if (key && v !== undefined) props[key] = v;
      }
    });
    trackEvent(name, Object.keys(props).length ? props : undefined);
  });
}
