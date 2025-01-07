import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatListOption } from '@angular/material/list';
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
    @Inject(MAT_DIALOG_DATA) public table: Table
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
      // Eliminar una instancia del ítem en la mesa principal
      const orderIndex = this.table.orders.findIndex(order => order.name === selectedOrder.name);
      if (orderIndex > -1) {
        const orderId = this.table.orders[orderIndex].id;
        this.coffeService.removeOrderFromTable(this.table.id, orderId); // Usar el servicio
      }
    });
  
    this.groupOrders(); // Actualizar la lista agrupada después de eliminar
  }

  closeDialog(): void {
    this.dialogRef.close(this.table.orders); // Envía la lista actualizada al componente padre
  }
}