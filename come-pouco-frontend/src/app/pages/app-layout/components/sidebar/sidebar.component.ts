import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { AppLogoComponent } from '../../../../shared/components/app-logo/app-logo.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

type NavItem = {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  visible?: () => boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatTooltipModule,
    AppLogoComponent,
    IconComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);

  readonly collapsed = input(false);
  readonly navigate = output<void>();

  protected readonly groups: NavGroup[] = [
    {
      label: 'Operacao',
      items: [
        { label: 'Home', route: '/home', icon: 'house', exact: true },
        { label: 'Links Afiliados', route: '/affiliate-links', icon: 'link' },
        {
          label: 'Conversoes',
          route: '/conversions',
          icon: 'activity',
          visible: () =>
            this.authService.isAdmin() ||
            this.authService.isOwner() ||
            this.authService.isEmployee(),
        },
      ],
    },
    {
      label: 'Administracao',
      items: [
        {
          label: 'Usuarios',
          route: '/users',
          icon: 'users',
          visible: () => this.authService.isAdmin(),
        },
        {
          label: 'Empresas',
          route: '/companies',
          icon: 'building-2',
          visible: () => this.authService.isAdmin(),
        },
        {
          label: 'Plataformas',
          route: '/purchase-platforms',
          icon: 'shopping-bag',
          visible: () => this.authService.isAdmin(),
        },
        {
          label: 'E-mail',
          route: '/admin/email-settings',
          icon: 'mail',
          visible: () => this.authService.isAdmin(),
        },
        {
          label: 'Status',
          route: '/admin/status',
          icon: 'activity',
          visible: () => this.authService.isAdmin(),
        },
      ],
    },
    {
      label: 'Conta',
      items: [
        {
          label: 'Minha Empresa',
          route: '/my-company',
          icon: 'building-2',
          visible: () => this.authService.isOwner(),
        },
        { label: 'Seguranca', route: '/security', icon: 'shield-check' },
      ],
    },
  ];

  protected visibleGroups(): NavGroup[] {
    return this.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.visible || item.visible()),
      }))
      .filter((group) => group.items.length > 0);
  }

  protected roleLabel(): string {
    if (this.authService.isAdmin()) {
      return 'ADMIN';
    }

    if (this.authService.isOwner()) {
      return 'OWNER';
    }

    return 'EMPLOYEE';
  }

  protected companyLabel(): string {
    return this.authService.currentUser()?.company?.name || 'auralinks';
  }

  protected onNavigate(): void {
    this.navigate.emit();
  }
}
