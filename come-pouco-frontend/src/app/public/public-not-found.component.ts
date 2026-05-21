import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './public-not-found.component.html',
  styleUrl: './public-not-found.component.scss',
})
export class PublicNotFoundComponent {}
