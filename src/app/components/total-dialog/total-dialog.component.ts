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
  discountedTotal: number = 0; // Total con descuento
  discountPercentage: number = 0; // Porcentaje de descuento aplicado

  constructor(
    @Inject(MAT_DIALOG_DATA) public table: Table,
    private dialogRef: MatDialogRef<TotalDialogComponent>
  ) {
    this.calculateTotal();
  }

  calculateTotal() {
    this.total = this.table.orders.reduce((sum, item) => sum + item.price, 0);
    this.calculateDiscountedTotal(); // Actualiza el total con descuento
  }

  applyDiscount(discount: number) {
    this.discountPercentage = discount;
    this.calculateDiscountedTotal();
  }

  calculateDiscountedTotal() {
    this.discountedTotal = this.total - (this.total * this.discountPercentage / 100);
  }

  liberarMesa() {
    this.dialogRef.close('liberar'); // Notifica al componente padre
  }
}