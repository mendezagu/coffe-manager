import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatListOption } from '@angular/material/list';
import { ChangeDetectorRef } from '@angular/core'; // Importar ChangeDetectorRef
import { CoffeService, MenuItem, Table } from 'src/app/models/coffe.service';

interface GroupedOrder {
  name: string;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-order-info-dialog',
  templateUrl: './order-info-dialog.component.html',
  styleUrls: ['./order-info-dialog.component.scss']
})
export class OrderInfoDialogComponent {
  groupedOrders: GroupedOrder[] = [];

  constructor(
    public dialogRef: MatDialogRef<OrderInfoDialogComponent>,
    public coffeService: CoffeService,
    @Inject(MAT_DIALOG_DATA) public table: Table,
    private cdr: ChangeDetectorRef // Inyección del ChangeDetectorRef
  ) {
    this.groupOrders();
  }

  private groupOrders(): void {
    const orderMap: { [key: string]: GroupedOrder } = {};
    this.table.orders.forEach(order => {
      if (orderMap[order.name]) {
        orderMap[order.name].quantity++;
      } else {
        orderMap[order.name] = { ...order, quantity: 1 };
      }
    });

    this.groupedOrders = Object.values(orderMap);
  }

  removeSelectedOrders(selectedOptions: MatListOption[]): void {
    const selectedOrders = selectedOptions.map(option => option.value as GroupedOrder);

    selectedOrders.forEach(selectedOrder => {
      const orderIndex = this.table.orders.findIndex(order => order.name === selectedOrder.name);
      if (orderIndex > -1) {
        const orderId = this.table.orders[orderIndex].id;
        this.coffeService.removeOrderFromTable(this.table.id, orderId); // Usar el servicio
        this.table.orders.splice(orderIndex, 1); // Eliminar de la lista local
      }
    });

    this.groupOrders(); // Actualizar la lista agrupada
    this.cdr.detectChanges(); // Forzar la detección de cambios
  }

  closeDialog(): void {
    this.dialogRef.close(this.table.orders); // Envía la lista actualizada al componente padre
  }
}