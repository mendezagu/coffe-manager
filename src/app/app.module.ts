import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module'; 

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatCheckboxModule} from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { AppComponent } from './app.component';
import { MenuDialogComponent } from './components/menu-dialog/menu-dialog.component';
import { CardComponent } from './components/app-card/app-cardcomponent';
import { TotalDialogComponent } from './components/total-dialog/total-dialog.component';
import { HomeComponent } from './pages/home/home.component';
import { OrderInfoDialogComponent } from './components/order-info-dialog/order-info-dialog.component';
import { LinkTableDialogComponent } from './components/link-table-dialog/link-table-dialog.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './services/auth.interceptor';
import { DatePipe } from '@angular/common';
import { WaiterDialogComponent } from './components/waiter-dialog/waiter-dialog.component';
import { LoginComponent } from './pages/login/login.component';
import { MatTableModule } from '@angular/material/table';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

import { KitchenComponent } from './pages/kitchen/kitchen.component';
import { UsersComponent } from './pages/users/users.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { CategoriesComponent } from './pages/categories/categories.component';
import { ModifiersComponent } from './pages/modifiers/modifiers.component';
import { CashComponent } from './pages/cash/cash.component';
import { CounterComponent } from './pages/counter/counter.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { InventoryStockComponent } from './pages/inventory/inventory-stock.component';
import { InventoryRecipesComponent } from './pages/inventory/inventory-recipes.component';
import { InventoryCountComponent } from './pages/inventory/inventory-count.component';
import { InventoryMovementsComponent } from './pages/inventory/inventory-movements.component';
import { InventoryProfitComponent } from './pages/inventory/inventory-profit.component';
import { UpgradeButtonComponent } from './components/upgrade-button/upgrade-button.component';
import { SizeImportComponent } from './components/size-import/size-import.component';
import { UpgradeWallComponent } from './components/upgrade-wall/upgrade-wall.component';
import { PlanPageComponent } from './pages/plan/plan.component';
import { DragScrollDirective } from './directives/drag-scroll.directive';
import { PlanBadgeComponent } from './components/plan-badge/plan-badge.component';
import { PaymentPanelComponent } from './components/payment-panel/payment-panel.component';
import { ModifierPickerDialogComponent } from './components/modifier-picker-dialog/modifier-picker-dialog.component';
import { MoneyPipe } from './pipes/money.pipe';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { QrOrderComponent } from './pages/qr-order/qr-order.component';
import { QrInboxDialogComponent } from './components/qr-inbox-dialog/qr-inbox-dialog.component';
import { QrCodesComponent } from './pages/qr-codes/qr-codes.component';
import { BalanceComponent } from './pages/balance/balance.component';
import { LogsComponent } from './components/logs/logs.component';
import { AppLoaderComponent } from './components/app-loader/app-loader.component';
import { HotelLandingComponent } from './pages/hotel-landing/hotel-landing.component';
import { HotelPortalComponent } from './pages/hotel-portal/hotel-portal.component';
import { HotelPartnershipsComponent } from './components/hotel-partnerships/hotel-partnerships.component';
import { OnboardingComponent } from './pages/onboarding/onboarding.component';
import { GettingStartedComponent } from './components/getting-started/getting-started.component';
import { SetupGateComponent } from './components/setup-gate/setup-gate.component';
import { GuideHintComponent } from './components/guide-hint/guide-hint.component';
import { PasswordToggleDirective } from './directives/password-toggle.directive';
import { CustomSelectDirective } from './directives/custom-select.directive';
import { FilterTabsComponent } from './components/filter-tabs/filter-tabs.component';
import { ReservationsComponent } from './pages/reservations/reservations.component';
import { ReserveComponent } from './pages/reserve/reserve.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';
import { ChangePasswordFormComponent } from './components/change-password-form/change-password-form.component';


@NgModule({
  declarations: [
    AppComponent,
    MenuDialogComponent,
    CardComponent,
    TotalDialogComponent,
    HomeComponent,
    OrderInfoDialogComponent,
    LinkTableDialogComponent,
    WaiterDialogComponent,
    LoginComponent,
    UsersComponent,
    SettingsComponent,
    ReportsComponent,
    CategoriesComponent,
    ModifiersComponent,
    CashComponent,
    CounterComponent,
    InventoryComponent,
    InventoryStockComponent,
    InventoryRecipesComponent,
    InventoryCountComponent,
    InventoryMovementsComponent,
    InventoryProfitComponent,
    PaymentPanelComponent,
    PlanBadgeComponent,
    DragScrollDirective,
    UpgradeButtonComponent,
    SizeImportComponent,
    UpgradeWallComponent,
    PlanPageComponent,
    ModifierPickerDialogComponent,
    MoneyPipe,
    KitchenComponent,
    AdminPanelComponent,
    BalanceComponent,
    LogsComponent,
    QrOrderComponent,
    QrInboxDialogComponent,
    QrCodesComponent,
    AppLoaderComponent,
    HotelLandingComponent,
    HotelPortalComponent,
    HotelPartnershipsComponent,
    OnboardingComponent,
    GettingStartedComponent,
    SetupGateComponent,
    GuideHintComponent,
    PasswordToggleDirective,
    CustomSelectDirective,
    FilterTabsComponent,
    ReservationsComponent,
    ReserveComponent,
    ConfirmDialogComponent,
    ChangePasswordComponent,
    ChangePasswordFormComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatSnackBarModule,
    DragDropModule,
    MatInputModule,
    MatSidenavModule,
    MatSelectModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    MatTableModule,
    MatProgressSpinnerModule,
    
    HttpClientModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [DatePipe, { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }],
  bootstrap: [AppComponent]
})
export class AppModule { }
