import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GestionService, MenuItem } from '../../services/gestionService';
import { Table } from '../../services/gestionService';
import { forkJoin, Observable, of } from 'rxjs';
import { UserService } from 'src/app/services/user.service';
import { SettingsService } from 'src/app/services/settings.service';
import { modifiersText, modifiersTotal } from 'src/app/utils/modifiers';

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
  modifiersText = modifiersText;
  removedOrdersCache: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<OrderInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private gestionService: GestionService,
    private userService: UserService,
    private settings: SettingsService,
  ) {
    this.table = data;
    console.log(this.table, 'Mesa seleccionada');
    this.orders = this.table.orders || [];
    // Guardar copia original para detectar cambios
    this.originalOrders = JSON.parse(JSON.stringify(this.orders));
    this.role$ = this.userService.getRoleState();
  }

  // Eliminar un ítem: el administrador siempre; mozos y cajeros solo si el negocio lo habilitó en "Mi negocio"
  canRemove(role: string | null): boolean {
    return role === 'admin' || ((role === 'waiter' || role === 'cashier') && !!this.settings.value.staffCanRemoveItems);
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
            // precio de una unidad: el del plato + lo que sumaron las opciones elegidas
            order.price = menuItem.price + modifiersTotal(order.modifiers);
            // precio del plato solo (sin extras), para mostrarlo aparte de los extras
            order.basePrice = menuItem.price;
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
      // Guardar una copia (con el nombre ya resuelto) para poder loguearla al guardar
      this.removedOrdersCache.push({ ...order });
      this.orders.splice(index, 1);
      this.table.orders = this.orders;
      this.hasChanges = true;
    }
  }

  // Guardar los cambios realizados: solo envía lo que cambió, no reemplaza toda la mesa
  saveChanges(): void {
    const removedOrderIds = this.removedOrdersCache.map(o => o._id);

    const quantityUpdates = this.orders
      .filter(curr => {
        const orig = this.originalOrders.find(o => o._id === curr._id);
        return orig && orig.quantity !== curr.quantity;
      })
      .map(curr => ({ orderId: curr._id, quantity: curr.quantity }));

    if (removedOrderIds.length === 0 && quantityUpdates.length === 0) {
      this.finishSaving();
      return;
    }

    const removeOrders$ = removedOrderIds.length > 0
      ? this.gestionService.deleteOrdersFromTable(this.table.id, removedOrderIds)
      : of(null);

    const updateQuantities$ = quantityUpdates.length > 0
      ? this.gestionService.updateOrderQuantities(this.table.id, quantityUpdates)
      : of(null);

    forkJoin([removeOrders$, updateQuantities$]).subscribe(
      () => {
        const changesLog = this.buildChangesLog();
        if (changesLog) {
          this.gestionService.saveLog(changesLog);
        }
        this.finishSaving();
      },
      (error) => {
        console.error('Error guardando cambios:', error);
        // si el motivo es de negocio (ej: no hay stock para subir la cantidad), se muestra tal cual
        const message = String(error?.message ?? '');
        alert(message && !message.startsWith('Error ') ? message : 'Error al actualizar las órdenes. Por favor, inténtalo de nuevo.');
      }
    );
  }

  // Construir mensaje de log con los cambios
  private buildChangesLog(): string {
    const modifiedOrders = this.orders.filter(curr => {
      const orig = this.originalOrders.find(o => o._id === curr._id);
      return orig && orig.quantity !== curr.quantity;
    });

    let logParts: string[] = [];

    if (this.removedOrdersCache.length > 0) {
      const itemsDeleted = this.removedOrdersCache.map(o => o.name || 'Item desconocido').join(', ');
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