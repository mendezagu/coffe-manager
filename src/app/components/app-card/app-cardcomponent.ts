import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CoffeService, MenuItem, Table } from 'src/app/models/coffe.service';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { TotalDialogComponent } from '../total-dialog/total-dialog.component';
import { OrderInfoDialogComponent } from '../order-info-dialog/order-info-dialog.component';
import { LinkTableDialogComponent } from '../link-table-dialog/link-table-dialog.component';
import { WaiterDialogComponent } from '../waiter-dialog/waiter-dialog.component';

@Component({
  selector: 'app-card',
  templateUrl: './app-card.component.html',
  styleUrls: ['./app-card.component.scss']
})
export class CardComponent implements OnInit, OnChanges{ 
  @Input() id: number = 0;
  @Input() name: string = '';
  @Input() available: boolean = false;
  @Input() orders: MenuItem[] = [];
  @Input() refreshLinkedTables: boolean = false;
  //@Input() controlledBy?: number;
  @Output() addOrder = new EventEmitter<{ tableId: number; menuItem: MenuItem }>();
  @Output() removeOrder = new EventEmitter<{ tableId: number; orderId: number }>();

  waiterId?: string; // ID del mozo asignado
  linkedTables: Table[] = [];
  linkedTablesNames: string = '';
  controlledBy?: number; 

  constructor(
    public dialog: MatDialog,
    public coffeService: CoffeService

  ) {}

  ngOnInit(): void {
    this.loadLinkedTables();
  }

  ngOnChanges(): void {
    this.loadLinkedTables(); // Recargar al detectar cambios
  }

 // Cargar mesas vinculadas y controlador
 loadLinkedTables(): void {
  const table = this.coffeService.getTables().find(t => t.id === this.id);
  if (table) {
    // Obtener las mesas vinculadas
    this.linkedTables = this.coffeService.getLinkedTables(this.id);
    
    // Obtener los nombres de las mesas vinculadas
    this.linkedTablesNames = this.linkedTables.map(t => t.name).join(', ');
    
    // Obtener otros detalles de la mesa
    this.waiterId = table.waiterId; // Mozo asignado
    this.controlledBy = table.controlledBy; // Controlador de la mesa
  }
}

  linkTable(): void {
    const dialogRef = this.dialog.open(LinkTableDialogComponent, {
      width: '400px',
      data: { tables: this.coffeService.getTables(), currentTableId: this.id }
    });

    dialogRef.afterClosed().subscribe((linkedTableId: number | null) => {
      if (linkedTableId) {
        this.coffeService.linkTables(this.id, linkedTableId);
        this.loadLinkedTables();
      }
    });
  }

  releaseTable(): void {
    this.coffeService.releaseTable(this.id); // Liberar y desvincular
    this.loadLinkedTables();
  }

  onAddOrder(): void {
    if (this.controlledBy) {
      alert(`Esta mesa está siendo administrada por la mesa ${this.controlledBy}`);
      return;
    }
  
    const dialogRef = this.dialog.open(WaiterDialogComponent, {
      width: '300px'
    });
  
    dialogRef.afterClosed().subscribe((waiterId: string | null) => {
      if (waiterId && this.coffeService.waiters.includes(waiterId)) {
        this.coffeService.assignWaiterToTable(this.id, waiterId);
  
        const menuDialogRef = this.dialog.open(MenuDialogComponent, {
          width: '400px',
          data: { menu: this.coffeService.getMenu() },
        });
  
        menuDialogRef.afterClosed().subscribe((selectedMenuItems: MenuItem[] | undefined) => {
          if (selectedMenuItems && selectedMenuItems.length > 0) {
            selectedMenuItems.forEach(menuItem =>
              this.addOrder.emit({ tableId: this.id, menuItem })
            );
          }
        });
  
        this.loadLinkedTables();
      } else {
        alert('ID de mozo inválido. Inténtelo nuevamente.');
      }
    });
  }

  onViewOrders() {
    const dialogRef = this.dialog.open(OrderInfoDialogComponent, {
      width: '400px',
      data: { ...this.coffeService.tables.find(t => t.id === this.id) },
    });
  
    dialogRef.afterClosed().subscribe((updatedOrders: MenuItem[] | undefined) => {
      if (updatedOrders) {
        // Encuentra la mesa en el servicio y sincroniza las órdenes
        const table = this.coffeService.tables.find(t => t.id === this.id);
        if (table) {
          table.orders = updatedOrders; // Actualiza el estado global
        }
      }
    });
  }

  onRemoveOrder(orderId: number) {
    this.removeOrder.emit({ tableId: this.id, orderId });
  }

  onGetTotal(): void {
    const dialogRef = this.dialog.open(TotalDialogComponent, {
      width: '400px',
      data: { ...this.coffeService.tables.find(t => t.id === this.id) },
    });
  
    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'liberar') {
        this.coffeService.releaseTable(this.id); // Llamar al servicio para liberar la mesa y las vinculadas
        this.loadLinkedTables(); // Actualizar el estado de la mesa
      }
    });
  }


  onLinkTable(): void {
    const dialogRef = this.dialog.open(LinkTableDialogComponent, {
      width: '400px',
      data: { tables: this.coffeService.getTables(), currentTableId: this.id }
    });
  
    dialogRef.afterClosed().subscribe((linkedTableIds: number[] | null) => {
      if (linkedTableIds && linkedTableIds.length > 0) {
        this.coffeService.linkMultipleTables(this.id, linkedTableIds);
        this.loadLinkedTables(); // Actualizar las vinculaciones locales
      }
    });
  }

}