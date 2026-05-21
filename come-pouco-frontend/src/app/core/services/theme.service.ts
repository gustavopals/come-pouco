import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'come_pouco_theme';
const THEME_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly currentThemeSignal = signal<ThemePreference>(this.getStoredTheme());
  private readonly systemThemeSignal = signal<ResolvedTheme>(this.getSystemTheme());

  readonly currentTheme = this.currentThemeSignal.asReadonly();
  readonly effectiveTheme = computed<ResolvedTheme>(() => {
    const currentTheme = this.currentThemeSignal();
    return currentTheme === 'system' ? this.systemThemeSignal() : currentTheme;
  });

  constructor() {
    this.watchSystemTheme();

    effect(() => {
      const preference = this.currentThemeSignal();
      const resolved = this.effectiveTheme();

      this.persistPreference(preference);
      this.applyTheme(preference, resolved);
    });
  }

  setTheme(theme: ThemePreference): void {
    this.currentThemeSignal.set(theme);
  }

  cycleTheme(): void {
    const nextTheme: Record<ThemePreference, ThemePreference> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };

    this.setTheme(nextTheme[this.currentThemeSignal()]);
  }

  private getStoredTheme(): ThemePreference {
    if (!this.isBrowser) {
      return 'system';
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme;
    }

    return 'system';
  }

  private getSystemTheme(): ResolvedTheme {
    if (!this.isBrowser || !window.matchMedia) {
      return 'light';
    }

    return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light';
  }

  private watchSystemTheme(): void {
    if (!this.isBrowser || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(THEME_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      this.systemThemeSignal.set(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', handleChange));
  }

  private persistPreference(theme: ThemePreference): void {
    if (!this.isBrowser) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  private applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme): void {
    const root = this.document.documentElement;

    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.classList.toggle('light', resolvedTheme === 'light');
    root.dataset['theme'] = preference;
    root.dataset['resolvedTheme'] = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }
}
