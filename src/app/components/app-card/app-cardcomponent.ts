import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { OrderInfoDialogComponent } from '../order-info-dialog/order-info-dialog.component';
import { GestionService, Table, Waiter } from 'src/app/services/gestionService';
import { WaiterDialogComponent } from '../waiter-dialog/waiter-dialog.component';

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
        // Verifica si hay un mozo asignado y busca su nombre en la lista de mozos
        const waiter = this.waiters.find((w) => w._id === table.waiterId);
        return {
          ...table,
          waiterName: waiter ? waiter.name : 'No asignado',
        };
      });
      console.log(this.tables, 'Mesas cargadas con mozos asignados');
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
    if (table && table.orders) {
      const dialogRef = this.dialog.open(OrderInfoDialogComponent, {
        width: '600px',
        data: table,
      });

      dialogRef.afterClosed().subscribe(result => {
        // Si es necesario, se puede recargar la información de la mesa aquí
        this.loadTables();
      });
    } else {
      console.error('La mesa no tiene órdenes o es undefined:', table);
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
}