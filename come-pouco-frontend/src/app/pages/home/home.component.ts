import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatCardModule,
    MatChipsModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  protected companyName$: Observable<string | null> = of(null);

  constructor(
    protected readonly authService: AuthService,
    private readonly companyService: CompanyService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();

    if (!user) {
      this.authService.me().subscribe({
        next: () => this.setupCompanyNameStream(),
        error: () => {
          this.errorMessage$.next('Falha ao carregar dados do usuario.');
          this.authService.logout();
        }
      });
      return;
    }

    this.setupCompanyNameStream();
  }

  private setupCompanyNameStream(): void {
    const user = this.authService.currentUser();

    if (!user?.companyId) {
      this.companyName$ = of(null);
      return;
    }

    if (user.company?.name) {
      this.companyName$ = of(user.company.name);
      return;
    }

    this.companyName$ = this.companyService.list().pipe(
      map(({ companies }) => {
        const company = companies.find((item) => item.id === user.companyId);
        return company?.name ?? null;
      })
    );
  }
}
