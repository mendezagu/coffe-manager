import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { canActivate, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/auth-guard';
import { AdminGuard } from './guards/adminGuard';
import { StadisticsComponent } from './pages/stadistics/stadistics.component';
import { BalanceComponent } from './pages/balance/balance.component';
import { LogsComponent } from './components/logs/logs.component';
import { AdminPasswordGuard } from './guards/admin-password.guard';

const redirectUnauthorized = () => redirectUnauthorizedTo(['/login']);
const redirectLoggedIn = () => redirectLoggedInTo(['/home']);

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/home' },
  { path: 'home', component: HomeComponent, ...canActivate(redirectUnauthorized) },
  { path: 'login', component: LoginComponent, ...canActivate(redirectLoggedIn) },
  { path: 'register', component: RegisterComponent, ...canActivate(redirectLoggedIn) },
  { path: 'admin', component: AdminPanelComponent, canActivate: [AdminPasswordGuard] }, // Ruta protegida para admins,
  { path: 'stadistic', component: StadisticsComponent, canActivate: [AdminPasswordGuard] }, // Ruta protegida para admins
  { path: 'balance', component: BalanceComponent, canActivate: [AdminPasswordGuard] }, // Ruta protegida para admins
  { path: 'logs', component: LogsComponent, canActivate: [AdminPasswordGuard] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }