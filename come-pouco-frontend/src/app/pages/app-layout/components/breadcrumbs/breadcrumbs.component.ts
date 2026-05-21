import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { IconComponent } from '../../../../shared/components/icon/icon.component';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  constructor() {
    this.updateBreadcrumbs();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.updateBreadcrumbs());
  }

  private updateBreadcrumbs(): void {
    this.breadcrumbs.set(this.buildBreadcrumbs(this.activatedRoute.root));
  }

  private buildBreadcrumbs(route: ActivatedRoute): BreadcrumbItem[] {
    const crumbs: BreadcrumbItem[] = [];
    let currentRoute: ActivatedRoute | null = route;
    let url = '';

    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;
      const routeUrl = currentRoute.snapshot?.url?.map((segment) => segment.path).join('/') ?? '';

      if (routeUrl) {
        url += `/${routeUrl}`;
      }

      const breadcrumb = currentRoute.snapshot?.data?.['breadcrumb'];

      if (typeof breadcrumb === 'string' && breadcrumb.trim().length) {
        crumbs.push({ label: breadcrumb, url: url || '/' });
      }
    }

    return crumbs;
  }
}
