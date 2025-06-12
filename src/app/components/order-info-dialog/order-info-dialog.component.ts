import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService, MenuItem } from '../../services/gestionService';
import { Table } from '../../services/gestionService';
import { Observable } from 'rxjs';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-order-info-dialog',
  templateUrl: './order-info-dialog.component.html',
  styleUrls: ['./order-info-dialog.component.scss']
})
export class OrderInfoDialogComponent implements OnInit {
  table: Table;
  orders: any[] = [];
    role$: Observable<string | null>;

  constructor(
    public dialogRef: MatDialogRef<OrderInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private gestionService: GestionService,
      private userService: UserService,
  ) {
    this.table = data;
    console.log(this.table, 'Mesa seleccionada');
    this.orders = this.table.orders || []; 
    this.role$ = this.userService.getRoleState();
  }

  ngOnInit(): void {
    this.printMenuItems();
  }

  // Método para imprimir los valores de name y quantity dentro de las órdenes
  printMenuItems(): void {
    this.orders.forEach(order => {
      if (order && order.menuItem && order.quantity !== undefined) {
        this.gestionService.getMenu().subscribe(menuItems => {
          const menuItem = menuItems.find(item => item._id === order.menuItem);
          if (menuItem) {
            order.name = menuItem.name; // Asignar el nombre directamente a la orden
          } else {
            order.name = 'No encontrado';
          }
        });
      }
    });
  }

  // Método para eliminar órdenes
 removeSelectedOrders(selectedOrders: any[]): void {
  const orderIdsToDelete = selectedOrders.map(order => order.value);

  // Guardar nombres para el log antes de eliminar
  const itemsToDeleteLog = selectedOrders.map(order => {
    const found = this.orders.find(o => o._id === order.value);
    return found && found.name ? found.name : `Item ID: ${order.value}`;
  });

  this.gestionService.deleteOrdersFromTable(this.table.id, orderIdsToDelete).subscribe(
    (updatedTable: Table) => {
      // Registrar log después del éxito
      this.gestionService.saveLog(
        `<strong style="color: red;">Se eliminaron</strong> órdenes: <strong> ${itemsToDeleteLog.join(', ')}</strong> de la mesa <strong>${this.table.name}</strong> atendida por <strong>${this.table.waiterName || 'Desconocido'}</strong>`,
      );

      this.table = updatedTable;
      this.orders = this.table.orders;
      this.printMenuItems(); // Actualizar nombres visibles
      this.dialogRef.close(); // Cierra el diálogo después de eliminar las órdenes
      location.reload();
    },
    (error) => {
      console.error('Error eliminando órdenes:', error);
    }
  );
}


  // Método para liberar la mesa
  releaseTable(): void {
    this.gestionService.releaseTable(this.table.id).subscribe(
      () => {
        this.dialogRef.close(); // Cierra el diálogo
      },
      (error) => {
        console.error('Error liberando la mesa:', error);
      }
    );
  }
}