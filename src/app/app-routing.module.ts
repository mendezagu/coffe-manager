import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { StadisticsComponent } from './pages/stadistics/stadistics.component';
import { BalanceComponent } from './pages/balance/balance.component';
import { LogsComponent } from './components/logs/logs.component';
import { KitchenComponent } from './pages/kitchen/kitchen.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { CashComponent } from './pages/cash/cash.component';
import { guestGuard, roleGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/home' },
  { path: 'home', component: HomeComponent, canActivate: [roleGuard('admin', 'cashier', 'waiter')] },
  { path: 'kitchen', component: KitchenComponent, canActivate: [roleGuard('admin', 'kitchen', 'bar')] },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'admin', component: AdminPanelComponent, canActivate: [roleGuard('admin')] },
  { path: 'admin/:section', component: AdminPanelComponent, canActivate: [roleGuard('admin')] },
  { path: 'cash', component: CashComponent, canActivate: [roleGuard('admin', 'cashier')] },
  { path: 'reports', component: ReportsComponent, canActivate: [roleGuard('admin')] },
  { path: 'settings', component: SettingsComponent, canActivate: [roleGuard('admin')] },
  { path: 'stadistic', component: StadisticsComponent, canActivate: [roleGuard('admin')] },
  { path: 'balance', component: BalanceComponent, canActivate: [roleGuard('admin')] },
  { path: 'logs', component: LogsComponent, canActivate: [roleGuard('admin')] },
  { path: '**', redirectTo: '/home' }, // cocina y barra rebotan de /home a /kitchen (roleGuard)
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
