import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { noPublicRegisterGuard } from './core/guards/no-public-register.guard';
import { ownerGuard } from './core/guards/owner.guard';
import { ownerOrAdminGuard } from './core/guards/owner-or-admin.guard';
import { usersCreateGuard } from './core/guards/users-create.guard';
import { AppLayoutComponent } from './pages/app-layout/app-layout.component';
import { AdminEmailSettingsComponent } from './pages/admin-email-settings/admin-email-settings.component';
import { AdminStatusComponent } from './pages/admin-status/admin-status.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { AffiliateLinksComponent } from './pages/affiliate-links/affiliate-links.component';
import { CompaniesComponent } from './pages/companies/companies.component';
import { MyCompanyComponent } from './pages/my-company/my-company.component';
import { PurchasePlatformsComponent } from './pages/purchase-platforms/purchase-platforms.component';
import { RegisterComponent } from './pages/register/register.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SecurityComponent } from './pages/security/security.component';
import { UsersComponent } from './pages/users/users.component';

export const routes: Routes = [
  {
    path: 'p/:companySlug',
    loadChildren: () => import('./public/public.routes').then((module) => module.publicRoutes),
  },
  {
    path: 'public-not-found',
    loadComponent: () =>
      import('./public/public-not-found.component').then(
        (module) => module.PublicNotFoundComponent,
      ),
  },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'register', component: RegisterComponent, canActivate: [noPublicRegisterGuard] },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: HomeComponent, data: { breadcrumb: 'Home' } },
      {
        path: 'users/new',
        component: UsersComponent,
        canActivate: [usersCreateGuard],
        data: { breadcrumb: 'Novo usuario' },
      },
      {
        path: 'users',
        component: UsersComponent,
        canActivate: [adminGuard],
        data: { breadcrumb: 'Usuarios' },
      },
      {
        path: 'companies',
        component: CompaniesComponent,
        canActivate: [adminGuard],
        data: { breadcrumb: 'Empresas' },
      },
      {
        path: 'my-company',
        component: MyCompanyComponent,
        canActivate: [ownerGuard],
        data: { breadcrumb: 'Minha Empresa' },
      },
      { path: 'minha-empresa', redirectTo: 'my-company', pathMatch: 'full' },
      {
        path: 'purchase-platforms',
        component: PurchasePlatformsComponent,
        canActivate: [adminGuard],
        data: { breadcrumb: 'Plataformas' },
      },
      {
        path: 'admin/email-settings',
        component: AdminEmailSettingsComponent,
        canActivate: [adminGuard],
        data: { breadcrumb: 'E-mail' },
      },
      {
        path: 'admin/status',
        component: AdminStatusComponent,
        canActivate: [adminGuard],
        data: { breadcrumb: 'Status' },
      },
      {
        path: 'affiliate-links',
        component: AffiliateLinksComponent,
        data: { breadcrumb: 'Links Afiliados' },
      },
      {
        path: 'conversions',
        loadComponent: () =>
          import('./pages/conversions/conversions-dashboard.component').then(
            (module) => module.ConversionsDashboardComponent,
          ),
        canActivate: [ownerOrAdminGuard],
        data: { breadcrumb: 'Conversoes' },
      },
      { path: 'security', component: SecurityComponent, data: { breadcrumb: 'Seguranca' } },
      { path: 'links-afiliados', redirectTo: 'affiliate-links', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
