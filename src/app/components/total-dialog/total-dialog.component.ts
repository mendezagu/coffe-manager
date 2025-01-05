import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Table } from 'src/app/models/coffe.service';

@Component({
  selector: 'app-total-dialog',
  templateUrl: './total-dialog.component.html',
  styleUrls: ['./total-dialog.component.scss']
})
export class TotalDialogComponent {
  total: number = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public table: Table,
    private dialogRef: MatDialogRef<TotalDialogComponent>
  ) {
    this.calculateTotal();
  }

  calculateTotal() {
    this.total = this.table.orders.reduce((sum, item) => sum + item.price, 0);
  }

  liberarMesa() {
    this.dialogRef.close('liberar');
  }
}
