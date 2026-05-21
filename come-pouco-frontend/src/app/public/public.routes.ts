import { Routes } from '@angular/router';

import { PublicHomeComponent } from './pages/public-home.component';
import { PublicLayoutComponent } from './public-layout.component';
import { publicLandingResolver } from './resolvers/public-landing.resolver';

export const publicRoutes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    resolve: {
      landing: publicLandingResolver,
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: PublicHomeComponent,
      },
      {
        path: ':employeeSlug',
        component: PublicHomeComponent,
      },
    ],
  },
];
