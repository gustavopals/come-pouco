import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  protected errorMessage = '';

  constructor(protected readonly authService: AuthService) {}

  ngOnInit(): void {
    if (!this.authService.currentUser()) {
      this.authService.me().subscribe({
        error: () => {
          this.errorMessage = 'Falha ao carregar dados do usuário.';
          this.authService.logout();
        }
      });
    }
  }

  protected logout(): void {
    this.authService.logout();
  }
}
