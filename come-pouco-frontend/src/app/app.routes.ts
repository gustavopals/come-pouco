import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { ownerGuard } from './core/guards/owner.guard';
import { AppLayoutComponent } from './pages/app-layout/app-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { AffiliateLinksComponent } from './pages/affiliate-links/affiliate-links.component';
import { CompaniesComponent } from './pages/companies/companies.component';
import { MyCompanyComponent } from './pages/my-company/my-company.component';
import { PurchasePlatformsComponent } from './pages/purchase-platforms/purchase-platforms.component';
import { RegisterComponent } from './pages/register/register.component';
import { SecurityComponent } from './pages/security/security.component';
import { UsersComponent } from './pages/users/users.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: HomeComponent },
      { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
      { path: 'companies', component: CompaniesComponent, canActivate: [adminGuard] },
      { path: 'my-company', component: MyCompanyComponent, canActivate: [ownerGuard] },
      { path: 'minha-empresa', redirectTo: 'my-company', pathMatch: 'full' },
      { path: 'purchase-platforms', component: PurchasePlatformsComponent, canActivate: [adminGuard] },
      { path: 'affiliate-links', component: AffiliateLinksComponent },
      { path: 'security', component: SecurityComponent },
      { path: 'links-afiliados', redirectTo: 'affiliate-links', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
