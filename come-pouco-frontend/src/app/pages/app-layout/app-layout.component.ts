import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { animate, style, transition, trigger } from '@angular/animations';

import { AuthService } from '../../core/services/auth.service';
import { BreadcrumbsComponent } from './components/breadcrumbs/breadcrumbs.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

const SIDEBAR_STATE_KEY = 'come_pouco_sidebar_state';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    RouterOutlet,
    BreadcrumbsComponent,
    SidebarComponent,
    TopbarComponent,
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('routeMotion', [
      transition('* <=> *', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('180ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
  ],
})
export class AppLayoutComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authService = inject(AuthService);

  protected readonly isMobile = signal(false);
  protected readonly isMobileDrawerOpen = signal(false);
  protected readonly isSidebarCollapsed = signal(this.readSidebarState());
  protected readonly prefersReducedMotion = signal(false);

  constructor() {
    this.watchReducedMotionPreference();

    this.breakpointObserver
      .observe('(max-width: 1023px)')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isMobile.set(state.matches);

        if (!state.matches) {
          this.closeMobileDrawer();
        }
      });
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    if (this.isMobileDrawerOpen()) {
      this.closeMobileDrawer();
    }
  }

  protected openMobileDrawer(): void {
    this.isMobileDrawerOpen.set(true);
  }

  protected closeMobileDrawer(): void {
    this.isMobileDrawerOpen.set(false);
  }

  protected toggleSidebar(): void {
    const nextState = !this.isSidebarCollapsed();
    this.isSidebarCollapsed.set(nextState);
    this.persistSidebarState(nextState);
  }

  protected logout(): void {
    this.closeMobileDrawer();
    this.authService.logout();
  }

  protected routeAnimation(outlet: RouterOutlet): string {
    return outlet.activatedRouteData?.['breadcrumb'] || 'route';
  }

  private readSidebarState(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_STATE_KEY) === 'collapsed';
    } catch {
      return false;
    }
  }

  private persistSidebarState(isCollapsed: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
    } catch {
      return;
    }
  }

  private watchReducedMotionPreference(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => this.prefersReducedMotion.set(media.matches);

    updatePreference();
    media.addEventListener('change', updatePreference);
    this.destroyRef.onDestroy(() => media.removeEventListener('change', updatePreference));
  }
}
