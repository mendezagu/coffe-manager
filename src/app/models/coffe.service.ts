import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  quantity?: number; 
}

export interface Table {
  id: number;
  name: string;
  available: boolean;
  orders: MenuItem[];
  linkedTables: number[];
  controlledBy?: number;
  waiterId?: string; 
}

@Injectable({
  providedIn: 'root'
})
export class CoffeService {
  waiters = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

  tables: Table[] = [
    { id: 1, name: 'Mesa 1', available: true, orders: [], linkedTables: []  },
    { id: 2, name: 'Mesa 2', available: true, orders: [], linkedTables: []  },
    { id: 3, name: 'Mesa 3', available: true, orders: [], linkedTables: []  },
    { id: 4, name: 'Mesa 4', available: true, orders: [], linkedTables: []  },
    { id: 5, name: 'Mesa 5', available: true, orders: [], linkedTables: []  },
    { id: 6, name: 'Mesa 6', available: true, orders: [], linkedTables: []  },
    { id: 7, name: 'Mesa 7', available: true, orders: [], linkedTables: []  },
    { id: 8, name: 'Mesa 8', available: true, orders: [], linkedTables: []  },
    { id: 9, name: 'Mesa 9', available: true, orders: [], linkedTables: []  },
    { id: 10, name: 'Mesa 10', available: true, orders: [], linkedTables: []  },
    { id: 11, name: 'Mesa 11', available: true, orders: [], linkedTables: []  },
    { id: 12, name: 'Mesa 12', available: true, orders: [], linkedTables: []  },
    { id: 13, name: 'Mesa 13', available: true, orders: [], linkedTables: []  },
    { id: 14, name: 'Mesa 14', available: true, orders: [], linkedTables: []  },
    { id: 15, name: 'Mesa 15', available: true, orders: [], linkedTables: []  },
    { id: 16, name: 'Mesa 16', available: true, orders: [], linkedTables: []  },
    { id: 17, name: 'Mesa 17', available: true, orders: [], linkedTables: []  },
    { id: 18, name: 'Mesa 18', available: true, orders: [], linkedTables: []  },
    { id: 19, name: 'Mesa 19', available: true, orders: [], linkedTables: []  },
    { id: 20, name: 'Mesa 20', available: true, orders: [], linkedTables: []  },
    { id: 21, name: 'Mesa 21', available: true, orders: [], linkedTables: []  },
    { id: 22, name: 'Mesa 22', available: true, orders: [], linkedTables: []  },
    { id: 23, name: 'Mesa 23', available: true, orders: [], linkedTables: []  },
    { id: 24, name: 'Mesa 24', available: true, orders: [], linkedTables: []  },
    { id: 25, name: 'Mesa 25', available: true, orders: [], linkedTables: []  },
];

  menu: MenuItem[] = [
    { id: 1, name: 'Café Americano', price: 2, quantity: 1 },
    { id: 2, name: 'Latte', price: 3, quantity: 1 },
    { id: 3, name: 'Cappuccino', price: 3.5, quantity: 1 },
    { id: 4, name: 'Espresso', price: 2.5, quantity: 1 },
    { id: 5, name: 'Flat White', price: 3.2, quantity: 1 },
    { id: 6, name: 'Mocha', price: 3.7, quantity: 1 },
    { id: 7, name: 'Macchiato', price: 3, quantity: 1 },
    { id: 8, name: 'Café con Leche', price: 2.8, quantity: 1 },
    { id: 9, name: 'Affogato', price: 4, quantity: 1 },
    { id: 10, name: 'Iced Coffee', price: 3.5, quantity: 1 }
  ];

  constructor() {}

  private tablesSubject = new BehaviorSubject<Table[]>(this.tables);
  tables$ = this.tablesSubject.asObservable(); // Observable para los cambios

  getTables() {
    return this.tables;
  }

  getMenu() {
    return this.menu;
  }

   // Asignar mozo a una mesa y las vinculadas
   assignWaiterToTable(tableId: number, waiterId: string): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      table.waiterId = waiterId;

      // Asignar mozo a las mesas vinculadas
      this.getLinkedTables(tableId).forEach(linkedTable => {
        linkedTable.waiterId = waiterId;
      });

      this.notifyTablesChange();
    }
  }

 // Liberar y desasignar mozos
 unassignWaiterFromTable(tableId: number): void {
  const table = this.tables.find(t => t.id === tableId);
  if (table) {
    table.waiterId = undefined;

    // Liberar las vinculadas
    this.getLinkedTables(tableId).forEach(linkedTable => {
      linkedTable.waiterId = undefined;
    });

    this.notifyTablesChange();
  }
}


  assignOrderToTable(tableId: number, order: MenuItem) {
    const table = this.tables.find((t) => t.id === tableId);
    if (table) {
      table.orders.push(order);
      table.available = table.orders.length === 0;
    }
  }

  releaseTable(tableId: number): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      // Liberar pedidos y disponibilidad
      table.orders = [];
      table.available = true;
  
      // Desasignar mozo de la mesa principal y vinculadas
      this.unassignWaiterFromTable(tableId);
  
      // Liberar y desvincular mesas vinculadas
      const linkedTables = this.getLinkedTables(tableId);
      linkedTables.forEach(linkedTable => {
        linkedTable.orders = [];
        linkedTable.available = true;
        linkedTable.controlledBy = undefined;
        linkedTable.linkedTables = linkedTable.linkedTables.filter(id => id !== tableId);
      });
  
      table.linkedTables = [];
      table.controlledBy = undefined;
  
      this.notifyTablesChange(); // Notificar cambios globales
    }
  }



  //ASIGNAR MENUSSS-------------------------------------------------
   // Obtener mesas vinculadas
   getLinkedTables(tableId: number): Table[] {
    const table = this.tables.find(t => t.id === tableId);
    return table ? this.tables.filter(t => table.linkedTables.includes(t.id)) : [];
  }


  // Vincular dos mesas
  linkTables(tableId1: number, tableId2: number): void {
    const table1 = this.tables.find(t => t.id === tableId1);
    const table2 = this.tables.find(t => t.id === tableId2);
  
    if (table1 && table2) {
      // Evitar duplicados en las listas de vinculación
      if (!table1.linkedTables.includes(tableId2)) {
        table1.linkedTables.push(tableId2);
      }
      if (!table2.linkedTables.includes(tableId1)) {
        table2.linkedTables.push(tableId1);
      }
  
      this.notifyTablesChange();// Notificar cambios globales si es necesario
    }
  }

  linkMultipleTables(baseTableId: number, tableIdsToLink: number[]): void {
    const baseTable = this.tables.find(t => t.id === baseTableId);
  
    if (baseTable) {
      tableIdsToLink.forEach(tableId => {
        const table = this.tables.find(t => t.id === tableId);
        if (table && !baseTable.linkedTables.includes(tableId)) {
          // Vincular bidireccionalmente
          baseTable.linkedTables.push(tableId);
          table.linkedTables.push(baseTableId);
  
          // Asignar controlador
          table.controlledBy = baseTableId;
        }
      });
  
      this.notifyTablesChange(); // Notificar cambios globales
    }
  }

  private notifyTablesChange(): void {
    this.tablesSubject.next([...this.tables]);
  }

  // Desvincular mesas
  unlinkTables(tableId1: number, tableId2: number): void {
    const table1 = this.tables.find(t => t.id === tableId1);
    const table2 = this.tables.find(t => t.id === tableId2);

    if (table1 && table2) {
      table1.linkedTables = table1.linkedTables.filter(id => id !== tableId2);
      table2.linkedTables = table2.linkedTables.filter(id => id !== tableId1);
    }
  }

 // Agregar pedido y sincronizar con mesas vinculadas
 addOrderToTable(tableId: number, menuItem: MenuItem): void {
  const table = this.tables.find(t => t.id === tableId);
  if (table) {
    table.orders.push(menuItem);

    // Sincronizar con todas las mesas vinculadas
    this.getLinkedTables(tableId).forEach(linkedTable => {
      linkedTable.orders = [...table.orders];
      linkedTable.available = false; // Marcar como ocupada
    });

    table.available = false; // Marcar la mesa original como ocupada
    this.notifyTablesChange(); // Notificar cambios
  }
}

// Obtener el total de las mesas vinculadas
getTotalForTable(tableId: number): number {
  const table = this.tables.find(t => t.id === tableId);
  if (table) {
    const linkedTables = this.getLinkedTables(tableId);
    const allOrders = [...table.orders, ...linkedTables.flatMap(t => t.orders)];
    return allOrders.reduce((sum, order) => sum + order.price, 0);
  }
  return 0;
}

removeOrderFromTable(tableId: number, orderId: number): void {
  const table = this.tables.find(t => t.id === tableId);

  if (table && !table.controlledBy) { // Solo si no está controlada
    table.orders = table.orders.filter(order => order.id !== orderId);

    // Sincronizar con mesas vinculadas
    this.getLinkedTables(tableId).forEach(linkedTable => {
      linkedTable.orders = linkedTable.orders.filter(order => order.id !== orderId);
    });

    this.notifyTablesChange(); // Notificar cambios
  }
}

}


