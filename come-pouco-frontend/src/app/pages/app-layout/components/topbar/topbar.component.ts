import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import type { AuthUser } from '../../../../core/models/auth.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    IconComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  readonly user = input<AuthUser | null>(null);
  readonly isMobile = input(false);
  readonly sidebarCollapsed = input(false);

  readonly openMobileMenu = output<void>();
  readonly toggleSidebar = output<void>();
  readonly logoutRequested = output<void>();

  protected initials(): string {
    const user = this.user();
    const source = user?.fullName || user?.username || 'AL';
    const parts = source
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }

  protected roleLabel(): string {
    const user = this.user();

    if (user?.role === 'ADMIN') {
      return 'Administrador';
    }

    if (user?.companyRole === 'OWNER') {
      return 'Owner';
    }

    return 'Afiliado';
  }

  protected userName(): string {
    const user = this.user();
    return user?.fullName || user?.username || 'Usuario';
  }
}
