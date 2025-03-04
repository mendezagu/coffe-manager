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
import { HttpClientModule } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { WaiterDialogComponent } from './components/waiter-dialog/waiter-dialog.component';
import { LoginComponent } from './pages/login/login.component';

import { environment } from 'src/environments/environment';
import {getAuth, provideAuth} from '@angular/fire/auth'
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { RegisterComponent } from './pages/register/register.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireModule } from '@angular/fire/compat';
import { StadisticsComponent } from './pages/stadistics/stadistics.component';
import { BalanceComponent } from './pages/balance/balance.component';


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
    RegisterComponent,
    AdminPanelComponent,
    StadisticsComponent,
    BalanceComponent,

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
    MatInputModule,
    MatSidenavModule,
    MatSelectModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    
    HttpClientModule,
    AngularFirestoreModule,
    AngularFireModule.initializeApp(environment.firebase),

    provideFirebaseApp(()=> initializeApp(environment.firebase)),
    provideAuth(()=> getAuth()),
    provideFirestore(() => getFirestore()),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [DatePipe],
  bootstrap: [AppComponent]
})
export class AppModule { }
