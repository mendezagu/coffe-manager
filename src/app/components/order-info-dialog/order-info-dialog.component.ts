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
  hasChanges: boolean = false;
  originalOrders: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<OrderInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private gestionService: GestionService,
    private userService: UserService,
  ) {
    this.table = data;
    console.log(this.table, 'Mesa seleccionada');
    this.orders = this.table.orders || [];
    // Guardar copia original para detectar cambios
    this.originalOrders = JSON.parse(JSON.stringify(this.orders));
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

  // Incrementar cantidad de un ítem
  increaseQuantity(order: any): void {
    order.quantity = (order.quantity || 1) + 1;
    this.hasChanges = true;
  }

  // Decrementar cantidad de un ítem
  decreaseQuantity(order: any): void {
    if (order.quantity > 1) {
      order.quantity -= 1;
      this.hasChanges = true;
    }
  }

  // Eliminar un ítem completamente
  removeOrder(order: any): void {
    const index = this.orders.findIndex(o => o._id === order._id);
    if (index > -1) {
      this.orders.splice(index, 1);
      this.table.orders = this.orders;
      this.hasChanges = true;
    }
  }

  // Guardar los cambios realizados
  saveChanges(): void {
    // Primero, eliminar todas las órdenes actuales de la mesa
    const allOrderIds = this.originalOrders.map(o => o._id);
    
    this.gestionService.deleteOrdersFromTable(this.table.id, allOrderIds).subscribe(
      () => {
        // Luego, agregar las órdenes actualizadas (si quedan algunas)
        if (this.orders.length > 0) {
          const itemsToAdd = this.orders.map(order => ({
            _id: order.menuItem,
            quantity: order.quantity,
            name: order.name,
            menuItem: order.menuItem,
            price: 0
          }));

          this.gestionService.addItemsToTable(this.table.id, itemsToAdd as any).subscribe(
            () => {
              // Registrar cambios en el log
              const changesLog = this.buildChangesLog();
              if (changesLog) {
                this.gestionService.saveLog(changesLog);
              }
              
              this.finishSaving();
            },
            (error) => {
              console.error('Error agregando órdenes actualizadas:', error);
              alert('Error al actualizar las órdenes. Por favor, inténtalo de nuevo.');
            }
          );
        } else {
          // Si no quedan órdenes, solo registrar la eliminación
          this.gestionService.saveLog(
            `<strong style="color: red;">Se eliminaron todas las órdenes</strong> de la mesa <strong>${this.table.name}</strong>`
          );
          this.finishSaving();
        }
      },
      (error) => {
        console.error('Error eliminando órdenes:', error);
        alert('Error al actualizar las órdenes. Por favor, inténtalo de nuevo.');
      }
    );
  }

  // Construir mensaje de log con los cambios
  private buildChangesLog(): string {
    const removedOrders = this.originalOrders.filter(
      orig => !this.orders.find(curr => curr._id === orig._id)
    );

    const modifiedOrders = this.orders.filter(curr => {
      const orig = this.originalOrders.find(o => o._id === curr._id);
      return orig && orig.quantity !== curr.quantity;
    });

    let logParts: string[] = [];

    if (removedOrders.length > 0) {
      const itemsDeleted = removedOrders.map(o => o.name || 'Item desconocido').join(', ');
      logParts.push(`<strong style="color: red;">Eliminados:</strong> ${itemsDeleted}`);
    }

    if (modifiedOrders.length > 0) {
      const changesDetail = modifiedOrders.map(order => {
        const orig = this.originalOrders.find(o => o._id === order._id);
        return `${order.name}: ${orig?.quantity} → ${order.quantity}`;
      }).join(', ');
      logParts.push(`<strong style="color: blue;">Cantidades actualizadas:</strong> ${changesDetail}`);
    }

    if (logParts.length === 0) return '';

    return `Cambios en la mesa <strong>${this.table.name}</strong>: ${logParts.join(' | ')}`;
  }

  // Finalizar guardado
  private finishSaving(): void {
    this.dialogRef.close();
    location.reload();
  }
}