import { Component, Inject, Injectable } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  // "danger" para lo que borra o no se puede deshacer (el botón va en rojo y el foco queda en Cancelar)
  tone?: 'default' | 'danger';
  icon?: string;
}

// Reemplaza al confirm() del navegador: mismo uso, pero con el estilo de la app
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  constructor(private dialog: MatDialog) {}

  ask(options: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmOptions, boolean>(ConfirmDialogComponent, {
        data: options,
        width: '440px',
        maxWidth: '92vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(map((ok) => ok === true));
  }
}

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  constructor(public ref: MatDialogRef<ConfirmDialogComponent, boolean>, @Inject(MAT_DIALOG_DATA) public data: ConfirmOptions) {}

  get danger(): boolean {
    return this.data.tone === 'danger';
  }
}
