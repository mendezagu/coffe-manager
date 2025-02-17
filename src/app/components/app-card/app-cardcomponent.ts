import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CoffeService, Table, MenuItem } from 'src/app/models/coffe.service';
import { MenuDialogComponent } from '../menu-dialog/menu-dialog.component';
import { TotalDialogComponent } from '../total-dialog/total-dialog.component';
import { OrderInfoDialogComponent } from '../order-info-dialog/order-info-dialog.component';
import { LinkTableDialogComponent } from '../link-table-dialog/link-table-dialog.component';
import { WaiterDialogComponent } from '../waiter-dialog/waiter-dialog.component';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-card',
  templateUrl: './app-card.component.html',
  styleUrls: ['./app-card.component.scss']
})
export class CardComponent implements OnInit, OnChanges {
  @Input() id: any = '';
  @Input() name: string = '';
  @Input() available: boolean = false;
  @Input() orders: MenuItem[] = [];
  @Input() refreshLinkedTables: boolean = false;
  @Output() addOrder = new EventEmitter<{ tableId: string; menuItem: MenuItem }>();
  @Output() removeOrder = new EventEmitter<{ tableId: string; orderId: number }>();

  waiterId?: any;
  waiterName?: any
  linkedTables: Table[] = [];
  linkedTablesNames: string = '';
  controlledBy?: any;
  hasOrders: boolean = false;

  constructor(
    public dialog: MatDialog,
    public coffeService: CoffeService,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit(): void {
    this.loadLinkedTables();
    this.updateOrderStatus();
  }

  ngOnChanges(): void {
    this.loadLinkedTables();
    this.updateOrderStatus();
  }

  getWaiterNameFromService(waiterId: string | null): string {
    if (!waiterId) return 'Sin asignar';
    const waiter = this.coffeService.getWaiters().find(w => w.id === waiterId);
    return waiter ? waiter.name : 'Mozo no encontrado';
  }

  loadLinkedTables(): void {
    const table = this.coffeService.getTables().find(t => t.id === this.id);
    if (table) {
      this.linkedTables = table.linkedTables
        .map(id => this.coffeService.getTables().find(t => t.id === id)!)
        .filter(t => t);
      
      this.linkedTablesNames = this.linkedTables.map(t => t.name).join(', ');
      this.waiterId = table.waiterId;
      this.waiterName = table.waiterName || this.getWaiterNameFromService(table.waiterId); // ✅ Asignar nombre
      this.controlledBy = table.controlledBy;
  
      // Si la mesa está controlada, copia el estado de la mesa administradora
      if (this.controlledBy) {
        const adminTable = this.coffeService.getTables().find(t => t.id === this.controlledBy);
        if (adminTable) {
          this.hasOrders = adminTable.orders.length > 0;
        }
      } else {
        this.hasOrders = table.orders.length > 0 || this.linkedTables.some(t => t.orders.length > 0);
      }
    }
  }

  linkTable(): void {
    const dialogRef = this.dialog.open(LinkTableDialogComponent, {
      width: '400px',
      data: { tables: this.coffeService.getTables(), currentTableId: this.id }
    });

    dialogRef.afterClosed().subscribe((linkedTableIds: string[] | null) => {
      if (linkedTableIds && linkedTableIds.length > 0) {
        this.coffeService.linkMultipleTables(this.id, linkedTableIds);
        this.loadLinkedTables();
      }
    });
  }

  releaseTable(): void {
    this.coffeService.releaseTable(this.id);
    this.loadLinkedTables();
    this.updateOrderStatus();
  }

  updateOrderStatus(): void {
    const table = this.coffeService.getTables().find(t => t.id === this.id);
  
    if (table) {
      if (this.controlledBy) {
        const adminTable = this.coffeService.getTables().find(t => t.id === this.controlledBy);
        if (adminTable) {
          this.hasOrders = adminTable.orders.length > 0;
          this.available = !this.hasOrders;
  
          // **Actualizar Firestore para reflejar el estado**
          this.coffeService.updateFirestore('tables', this.id, {
            available: !this.hasOrders
          });
        }
      } else {
        this.hasOrders = table.orders.length > 0 || this.linkedTables.some(t => t.orders.length > 0);
        this.available = !this.hasOrders;
  
        // **Si la mesa está ocupada, marcar todas las vinculadas como ocupadas**
        if (this.hasOrders) {
          this.linkedTables.forEach(linkedTable => {
            linkedTable.available = false;
  
            this.coffeService.updateFirestore('tables', linkedTable.id, {
              available: false
            });
          });
        }
      }
    }
  
    this.cdr.detectChanges(); // Forzar actualización en la vista
  }

  onAddOrder(): void {
    if (this.controlledBy) {
      alert(`Esta mesa está siendo administrada por la mesa ${this.controlledBy}`);
      return;
    }
  
    // Si la mesa ya tiene un mozo asignado, abrir directamente el menú
    if (this.waiterId) {
      this.openMenuDialog();
      return;
    }
  
    // Abrir el diálogo de selección de mozo
    const waiterDialogRef = this.dialog.open(WaiterDialogComponent, {
      width: '400px',
      data: { waiters: this.coffeService.getWaiters() }
    });
  
    waiterDialogRef.afterClosed().subscribe((waiterId: string | null) => {
      if (waiterId) {
        const waiter = this.coffeService.getWaiters().find(w => w.id === waiterId);
        if (waiter) {
          this.waiterId = waiterId;
          this.waiterName = waiter.name; // ✅ Asignar nombre del mozo
  
          const table = this.coffeService.getTables().find(t => t.id === this.id);
          if (table) {
            table.waiterId = waiterId;
            table.waiterName = waiter.name; // ✅ Guardar también en la mesa
  
            // **Actualizar Firestore con el nombre del mozo**
            this.coffeService.updateFirestore('tables', this.id, {
              waiterId: waiterId,
              waiterName: waiter.name // ✅ Guardar nombre en Firestore
            });
  
            this.cdr.detectChanges();
          }
  
          // Abrir el menú después de seleccionar el mozo
          this.openMenuDialog();
        }
      }
    });
  }
  
  // Función para abrir el menú de órdenes
  openMenuDialog(): void {
    const menuDialogRef = this.dialog.open(MenuDialogComponent, {
      width: '800px',
      data: { menu: this.coffeService.getMenu() },
    });
  
    menuDialogRef.afterClosed().subscribe((selectedMenuItems: MenuItem[] | undefined) => {
      if (selectedMenuItems && selectedMenuItems.length > 0) {
        const table = this.coffeService.getTables().find(t => t.id === this.id);
        if (table) {
          selectedMenuItems.forEach(menuItem => {
            table.orders.push(menuItem);
          });
  
          this.hasOrders = table.orders.length > 0;
          this.available = false; // Marcar la mesa como ocupada
  
          // **Actualizar Firestore con las órdenes**
          this.coffeService.updateFirestore('tables', this.id, {
            orders: table.orders,
            available: false // Marcar como ocupada en la base de datos
          });
  
          this.cdr.detectChanges();
        }
      }
    });
  }

  onViewOrders() {
    const table = this.coffeService.getTables().find(t => t.id === this.id);
    
    if (!table) {
      console.error('No se encontró la mesa');
      return;
    }
  
    const dialogRef = this.dialog.open(OrderInfoDialogComponent, {
      width: '800px',
      data: table, // Pasar directamente el objeto table
    });
  
    dialogRef.afterClosed().subscribe((updatedOrders: MenuItem[] | undefined) => {
      if (updatedOrders) {
        this.coffeService.getTables().find(t => t.id === this.id)!.orders = updatedOrders;
        this.updateOrderStatus();
      }
    });
  }
  

  onRemoveOrder(orderId: number): void {
    const table = this.coffeService.getTables().find(t => t.id === this.id);
    if (table) {
      table.orders = table.orders.filter(order => order.id !== orderId);
  
      this.hasOrders = table.orders.length > 0;
      this.available = !this.hasOrders; // Si no hay órdenes, la mesa se libera
  
      // **Actualizar Firestore**
      this.coffeService.updateFirestore('tables', this.id, {
        orders: table.orders,
        available: !this.hasOrders // La mesa se libera si ya no tiene órdenes
      });
  
      this.cdr.detectChanges();
    }
  }

  onGetTotal(): void {
    const table = this.coffeService.getTables().find(t => t.id === this.id);
    
    if (!table) {
      console.error('No se encontró la mesa');
      return;
    }
  
    const dialogRef = this.dialog.open(TotalDialogComponent, {
      width: '400px',
      data: table,
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'mesa_liberada') {
        this.available = true; // Marcar la mesa como disponible
        this.hasOrders = false;
        this.controlledBy = undefined;
        this.linkedTables = [];
  
        // Forzar actualización en Firestore
        this.coffeService.updateFirestore('tables', this.id, {
          available: true,
          hasOrders: false,
          controlledBy: null,
          linkedTables: []
        });
  
        this.cdr.detectChanges(); // Forzar actualización en la vista
      }
    });
  }

  getWaiterName(): string {
    if (!this.waiterId) return 'Sin asignar';
    const waiter = this.coffeService.getWaiters().find(w => w.id === this.waiterId);
    return waiter ? waiter.name : 'Mozo no encontrado';
  }
}
