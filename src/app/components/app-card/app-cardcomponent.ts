import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { OrderInfoDialogComponent } from '../order-info-dialog/order-info-dialog.component';
import { GestionService, Table } from 'src/app/services/gestionService';
import { WaiterDialogComponent } from '../waiter-dialog/waiter-dialog.component';

@Component({
  selector: 'app-card',
  templateUrl: './app-card.component.html',
  styleUrls: ['./app-card.component.scss']
})
export class CardComponent implements OnInit {
  tables: Table[] = [];

  constructor(
    private gestionService: GestionService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.gestionService.getTables().subscribe((tables) => {
      this.tables = tables;
      console.log(this.tables, 'Mesas cargadas');
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
        this.gestionService.assignWaiterToTable(table.id, waiterId, waiterName).subscribe({
          next: (response) => {
            console.log('Mozo asignado correctamente:', response);
  
            // Actualizar la mesa localmente
            table.waiterId = waiterId;
            table.waiterName = waiterName;
            console.log(waiterName,'NOMBREMOZO');
            
  
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
        this.gestionService.assignWaiterToTable(table.id, waiterId, waiterName).subscribe({
          next: (response) => {
            console.log('Mozo asignado correctamente:', response);
  
            // Actualizar la mesa localmente
            table.waiterId = waiterId;
            table.waiterName = waiterName;
  
            this.loadTables(); // Recargar las mesas actualizadas
          },
          error: (error) => {
            console.error('Error al asignar el mozo:', error);
          }
        });
      }
    });
  }
}