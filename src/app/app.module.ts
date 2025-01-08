import { NgModule } from '@angular/core';
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
import { AppComponent } from './app.component';
import { MenuDialogComponent } from './components/menu-dialog/menu-dialog.component';
import { CardComponent } from './components/app-card/app-cardcomponent';
import { TotalDialogComponent } from './components/total-dialog/total-dialog.component';
import { HomeComponent } from './pages/home/home.component';
import { OrderInfoDialogComponent } from './components/order-info-dialog/order-info-dialog.component';
import { LinkTableDialogComponent } from './components/link-table-dialog/link-table-dialog.component';

@NgModule({
  declarations: [
    AppComponent,
    MenuDialogComponent,
    CardComponent,
    TotalDialogComponent,
    HomeComponent,
    OrderInfoDialogComponent,
    LinkTableDialogComponent

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
    MatSnackBarModule,
    MatInputModule,
    MatListModule,
    MatIconModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
