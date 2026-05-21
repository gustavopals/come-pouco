import { CommonModule } from '@angular/common';
import { Component, HostBinding, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { ThemeService } from '../core/services/theme.service';
import { PublicLandingResponse } from './models/public-landing.model';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly themeService = inject(ThemeService);

  protected readonly landing = toSignal(
    this.route.data.pipe(map((data) => data['landing'] as PublicLandingResponse)),
    { initialValue: null },
  );

  protected readonly config = computed(() => this.landing()?.landingConfig ?? null);
  protected readonly company = computed(() => this.landing()?.company ?? null);

  @HostBinding('style.--public-primary')
  protected get publicPrimary(): string {
    return this.config()?.primaryColor || '#10b981';
  }

  @HostBinding('attr.data-public-theme')
  protected get publicTheme(): string {
    return this.themeService.effectiveTheme();
  }
}
