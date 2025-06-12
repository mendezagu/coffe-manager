import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PasswordDialogComponent } from '../components/password-dialog/password-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class AdminPasswordGuard implements CanActivate {
  constructor(private dialog: MatDialog, private snackBar: MatSnackBar) {}

  canActivate(): Observable<boolean> {
    const dialogRef = this.dialog.open(PasswordDialogComponent, {
      width: '300px',
      disableClose: true,
    });

    return dialogRef.afterClosed().pipe(
      switchMap((result) => {
        const correctPassword = 'cachica2025'; // <-- contraseña válida

        if (result === correctPassword) {
          return of(true);
        } else {
          if (result !== null) {
            // Solo si no canceló
            this.snackBar.open('Contraseña incorrecta', 'Cerrar', {
              duration: 3000,
              panelClass: ['snackbar-error', 'snackbar-center'],
            });
          }
          return of(false);
        }
      })
    );
  }
}
