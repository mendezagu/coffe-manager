import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { OrderInfoDialogComponent } from '../order-info-dialog/order-info-dialog.component';
import { GestionService, Table, Waiter } from 'src/app/services/gestionService';
import { WaiterDialogComponent } from '../waiter-dialog/waiter-dialog.component';
import { TotalDialogComponent } from '../total-dialog/total-dialog.component';
import { LinkTableDialogComponent } from '../link-table-dialog/link-table-dialog.component';

@Component({
  selector: 'app-card',
  templateUrl: './app-card.component.html',
  styleUrls: ['./app-card.component.scss']
})
export class CardComponent implements OnInit {
  tables: Table[] = [];
  waiters: Waiter[] = [];

  constructor(
    private gestionService: GestionService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTables();

     // Cargar los mozos al iniciar el componente
     this.gestionService.getWaiters().subscribe({
      next: (waiters) => {
        this.waiters = waiters;
        console.log(waiters,'LOS MOZOS dede HOME');
        
      },
      error: (error) => {
        console.error('Error al cargar los mozos:', error);
      }
    });
  }

  loadTables(): void {
    this.gestionService.getTables().subscribe((tables) => {
      this.tables = tables.map((table) => {
        const waiter = this.waiters.find((w) => w._id === table.waiterId);
        return {
          ...table,
          waiterName: waiter ? waiter.name : 'No asignado',
          available: table.controlledBy ? false : table.available, // Ocupa las mesas vinculadas
          linkedTables: table.linkedTables || [] // Asegura que siempre haya un array
        };
      });
    });
  }

  // Método para abrir el diálogo de agregar ítems
  addMenuItems(table: Table): void {
    const waiterDialogRef = this.dialog.open(WaiterDialogComponent, {
      width: '400px',
      data: { table }
    });
  
    waiterDialogRef.afterClosed().subscribe(result => {
      if (result) {
        const { waiterId, waiterName } = result;
  
        // Asigna el mozo a la mesa usando su ID
        this.gestionService.assignWaiterToTable(table.id, waiterId).subscribe({
          next: (response) => {
            console.log('Mozo asignado correctamente:', response);
        
            // Actualizar la mesa localmente con el nombre desde la respuesta
            table.waiterId = response.table.waiterId;
            table.waiterName = response.table.waiterName;
        
            console.log(`Nombre del mozo asignado: ${table.waiterName}`);
        
            // Abre el diálogo de menú después de asignar el mozo
            const menuDialogRef = this.dialog.open(MenuDialogComponent, {
              width: '400px',
              data: table,
            });
        
            menuDialogRef.afterClosed().subscribe((menu: any[]) => {
              if (menu && menu.length > 0) {
                this.gestionService.addItemsToTable(table.id, menu).subscribe(() => {
                  this.loadTables(); // Recargar las mesas actualizadas
                });
              }
            });
          },
          error: (error) => {
            console.error('Error al asignar el mozo:', error);
            alert('No se pudo asignar el mozo. Inténtalo nuevamente.');
          }
        });
      }
    });
  }
  // Método para abrir el diálogo de información de la mesa
  openTableInfoDialog(table: Table): void {
    if (table && Array.isArray(table.orders)) {  // Validamos que orders sea un array
      const dialogRef = this.dialog.open(OrderInfoDialogComponent, {
        width: '600px',
        data: table
      });
  
      dialogRef.afterClosed().subscribe(result => {
        this.loadTables();
      });
    } else {
      console.error('La mesa no tiene órdenes o es undefined:', table);
    }
  }
  openTotalDialog(table: Table): void {
    if (table && table.orders && table.orders.length > 0) {
      const dialogRef = this.dialog.open(TotalDialogComponent, {
        width: '600px',
        data: { tableId: table.id,
            orders: table.orders,
            tableName: table.name,        // Asegúrate de pasar el nombre de la mesa
            waiterName: table.waiterName  }
      });
  
      dialogRef.afterClosed().subscribe(result => {
        if (result?.status === 'mesa_liberada') {
          console.log(`Mesa con ID ${result.tableId} liberada correctamente.`);
          
          // 🔄 Recargar las mesas si la mesa fue liberada
          this.loadTables();
        }
      });
    } else {
      console.warn('La mesa no tiene órdenes.');
    }
  }

  // Método para abrir el diálogo de asignación de mozo
  openWaiterDialog(table: Table): void {
    const dialogRef = this.dialog.open(WaiterDialogComponent, {
      width: '400px',
      data: { table }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const { waiterId, waiterName } = result;
  
        this.gestionService.assignWaiterToTable(table.id, waiterId).subscribe({
          next: (response) => {
            console.log('Mozo asignado correctamente:', response);
        
            // Actualizar la mesa localmente con el nombre desde la respuesta
            table.waiterId = response.table.waiterId;
            table.waiterName = response.table.waiterName;
        
            console.log(`Nombre del mozo asignado: ${table.waiterName}`);
        
            // Abre el diálogo de menú después de asignar el mozo
            const menuDialogRef = this.dialog.open(MenuDialogComponent, {
              width: '400px',
              data: table,
            });
        
            menuDialogRef.afterClosed().subscribe((menu: any[]) => {
              if (menu && menu.length > 0) {
                this.gestionService.addItemsToTable(table.id, menu).subscribe(() => {
                  this.loadTables(); // Recargar las mesas actualizadas
                });
              }
            });
          },
          error: (error) => {
            console.error('Error al asignar el mozo:', error);
            alert('No se pudo asignar el mozo. Inténtalo nuevamente.');
          }
        });
      }
    });
  }

// Método para abrir el diálogo de vinculación de mesas
openLinkTablesDialog(table: Table): void {
  const dialogRef = this.dialog.open(LinkTableDialogComponent, {
    width: '400px',
    data: { table }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.gestionService.linkTables(table.id, result).subscribe({
        next: (response) => {
          console.log('Mesas vinculadas correctamente:', response);

          // 🔄 Actualizar directamente el estado de las mesas
          this.tables = this.tables.map((t) => {
            if (t.id === table.id) {
              return { ...t, linkedTables: result, available: false };
            } else if (result.includes(t.id)) {
              return { ...t, controlledBy: table.id, available: false };
            }
            return t;
          });
        },
        error: (error) => {
          console.error('Error al vincular las mesas:', error);
        }
      });
    }
  });
}

// Método para desvincular mesas
unlinkTables(table: Table): void {
  const linkedTableIds = table.linkedTables;
  this.gestionService.unlinkTables(table.id, linkedTableIds).subscribe({
    next: (response) => {
      console.log('Mesas desvinculadas correctamente:', response);
      this.loadTables(); // Recargar las mesas actualizadas
    },
    error: (error) => {
      console.error('Error al desvincular las mesas:', error);
    }
  });
}

// Obtener el nombre de una mesa por su ID
getTableNameById(tableId: string): string {
  const table = this.tables.find(t => t.id === tableId);
  return table ? table.name : 'Desconocida';
}

getControllingTableName(controlledById: string): string {
  const controllingTable = this.tables.find((t) => t.id === controlledById);
  return controllingTable ? controllingTable.name : 'Desconocida';
}

// Verificar si una mesa es la última en la lista de mesas vinculadas
isLastLinkedTable(linkedTables: string[], tableId: string): boolean {
  return linkedTables.indexOf(tableId) === linkedTables.length - 1;
}
 
}