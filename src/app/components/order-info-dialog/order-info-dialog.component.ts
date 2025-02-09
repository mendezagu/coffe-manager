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
  allOrdersRemoved: boolean = false; // Nuevo indicador

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
      // Asegúrate de usar `order.quantity || 1` por si viene undefined
      const qty = order.quantity ?? 1;
  
      if (orderMap[order.name]) {
        // Suma la cantidad
        orderMap[order.name].quantity += qty; 
      } else {
        // Inicia con la cantidad de este item
        orderMap[order.name] = { ...order, quantity: qty };
      }
    });

    this.groupedOrders = Object.values(orderMap);
    this.allOrdersRemoved = this.groupedOrders.length === 0; // Actualizar el indicador
  }

  removeSelectedOrders(selectedOptions: MatListOption[]): void {
    const selectedOrders = selectedOptions.map(option => option.value as GroupedOrder);
  
    selectedOrders.forEach(selectedOrder => {
      const orderIndex = this.table.orders.findIndex(order => order.name === selectedOrder.name);
      if (orderIndex > -1) {
        const orderId = this.table.orders[orderIndex].id;
        this.coffeService.removeOrderFromTable(this.table.id, orderId); // Actualiza en el servicio
        this.table.orders.splice(orderIndex, 1); // Elimina localmente
      }
    });
  
    this.groupOrders(); // Reagrupa las órdenes
    this.allOrdersRemoved = this.table.orders.length === 0; // Actualiza si ya no hay órdenes
    this.cdr.detectChanges(); // Forza la detección de cambios
  }

  releaseTable(): void {
    this.coffeService.releaseTable(this.table.id); // Liberar la mesa
    this.dialogRef.close([]); // Cerrar el diálogo y enviar una lista vacía
  }

  closeDialog(): void {
    this.dialogRef.close(this.table.orders); // Envía la lista actualizada al componente padre
  }
}