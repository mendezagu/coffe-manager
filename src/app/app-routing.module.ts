import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { BalanceComponent } from './pages/balance/balance.component';
import { LogsComponent } from './components/logs/logs.component';
import { KitchenComponent } from './pages/kitchen/kitchen.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { CounterComponent } from './pages/counter/counter.component';
import { CashComponent } from './pages/cash/cash.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { QrOrderComponent } from './pages/qr-order/qr-order.component';
import { HotelLandingComponent } from './pages/hotel-landing/hotel-landing.component';
import { HotelPortalComponent } from './pages/hotel-portal/hotel-portal.component';
import { OnboardingComponent } from './pages/onboarding/onboarding.component';
import { ReservationsComponent } from './pages/reservations/reservations.component';
import { ReserveComponent } from './pages/reserve/reserve.component';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';
import { guestGuard, pendingPasswordGuard, roleGuard } from './guards/auth.guard';
import { onboardingGuard } from './guards/onboarding.guard';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/home' },
  { path: 'home', component: HomeComponent, canActivate: [roleGuard('admin', 'cashier', 'waiter'), onboardingGuard] },
  // Asistente de primeros pasos para un negocio nuevo (pantalla completa, sin menú)
  { path: 'bienvenida', component: OnboardingComponent, canActivate: [roleGuard('admin')] },
  { path: 'kitchen', component: KitchenComponent, canActivate: [roleGuard('admin', 'kitchen', 'bar')] },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  // Primer ingreso con una contraseña asignada por otra persona: hay que cambiarla antes de seguir
  { path: 'cambiar-clave', component: ChangePasswordComponent, canActivate: [pendingPasswordGuard] },
  { path: 'admin', component: AdminPanelComponent, canActivate: [roleGuard('admin')] },
  { path: 'admin/:section', component: AdminPanelComponent, canActivate: [roleGuard('admin')] },
  { path: 'inventory', component: InventoryComponent, canActivate: [roleGuard('admin')] },
  { path: 'counter', component: CounterComponent, canActivate: [roleGuard('admin', 'cashier'), onboardingGuard] },
  { path: 'cash', component: CashComponent, canActivate: [roleGuard('admin', 'cashier')] },
  { path: 'reservations', component: ReservationsComponent, canActivate: [roleGuard('admin', 'cashier')] },
  { path: 'reports', component: ReportsComponent, canActivate: [roleGuard('admin')] },
  { path: 'settings', component: SettingsComponent, canActivate: [roleGuard('admin')] },
  { path: 'balance', component: BalanceComponent, canActivate: [roleGuard('admin')] },
  { path: 'logs', component: LogsComponent, canActivate: [roleGuard('admin')] },
  // Pantalla pública del cliente (QR de la mesa): sin sesión; lo único que da acceso es el código del QR
  { path: 'mesa/:token', component: QrOrderComponent },
  // Pantalla pública del huésped (QR del hotel): sin sesión
  { path: 'hotel/:slug', component: HotelLandingComponent },
  { path: 'reservar/:slug', component: ReserveComponent },
  // Portal del hotel: tiene su propio login (no usa el del personal de los restaurantes)
  { path: 'hotel-portal', component: HotelPortalComponent },
  { path: '**', redirectTo: '/home' }, // cocina y barra rebotan de /home a /kitchen (roleGuard)
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
