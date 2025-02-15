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

export interface Waiter {
  id: number;
  name: string;
}



@Injectable({
  providedIn: 'root'
})
export class CoffeService {
 

  private localStorageKey = 'tablesState';

  private localStorageWaitersKey = 'waitersState';

  private localStorageMenuKey = 'menuState';

  private broadcastChannel = new BroadcastChannel('cafe_sync');

  waiters: Waiter[] = this.loadWaitersFromStorage();
  menu: MenuItem[] = this.loadMenuFromStorage();
  tables: Table[] = this.loadTablesFromStorage();


  private loadTablesFromStorage(): Table[] {
    const storedData = localStorage.getItem(this.localStorageKey);
    if (storedData) {
      return JSON.parse(storedData);
    }
    return [
      { id: 1, name: 'Mesa 1', available: true, orders: [], linkedTables: [] },
      { id: 2, name: 'Mesa 2', available: true, orders: [], linkedTables: [] },
      { id: 3, name: 'Mesa 3', available: true, orders: [], linkedTables: [] },
      { id: 4, name: 'Mesa 4', available: true, orders: [], linkedTables: [] },
      { id: 5, name: 'Mesa 5', available: true, orders: [], linkedTables: [] },
      { id: 6, name: 'Mesa 6', available: true, orders: [], linkedTables: [] },
      { id: 7, name: 'Mesa 7', available: true, orders: [], linkedTables: [] },
      { id: 8, name: 'Mesa 8', available: true, orders: [], linkedTables: [] },
      { id: 9, name: 'Mesa 9', available: true, orders: [], linkedTables: [] },
      { id: 10, name: 'Mesa 10', available: true, orders: [], linkedTables: [] },
      { id: 11, name: 'Mesa 11', available: true, orders: [], linkedTables: [] },
      { id: 12, name: 'Mesa 12', available: true, orders: [], linkedTables: [] },
      { id: 13, name: 'Mesa 13', available: true, orders: [], linkedTables: [] },
      { id: 14, name: 'Mesa 14', available: true, orders: [], linkedTables: [] },
      { id: 15, name: 'Mesa 15', available: true, orders: [], linkedTables: [] },
      { id: 16, name: 'Mesa 16', available: true, orders: [], linkedTables: [] },
      { id: 17, name: 'Mesa 17', available: true, orders: [], linkedTables: [] },
      { id: 18, name: 'Mesa 18', available: true, orders: [], linkedTables: [] },
      { id: 19, name: 'Mesa 19', available: true, orders: [], linkedTables: [] },
      { id: 20, name: 'Mesa 20', available: true, orders: [], linkedTables: [] },
      { id: 21, name: 'Mesa 21', available: true, orders: [], linkedTables: [] },
      { id: 22, name: 'Mesa 22', available: true, orders: [], linkedTables: [] },
      { id: 23, name: 'Mesa 23', available: true, orders: [], linkedTables: [] },
      { id: 24, name: 'Mesa 24', available: true, orders: [], linkedTables: [] },
      { id: 25, name: 'Mesa 25', available: true, orders: [], linkedTables: [] }
    ];
  }

  private loadWaitersFromStorage(): Waiter[] {
    const storedData = localStorage.getItem(this.localStorageWaitersKey);
    return storedData ? JSON.parse(storedData) : [
      { id: 1, name: 'Juan Pérez' },
      { id: 2, name: 'María López' },
      { id: 3, name: 'Carlos Ramírez' },
      { id: 4, name: 'Ana González' },
      { id: 5, name: 'Pedro Martínez' },
      { id: 6, name: 'Sofía Torres' }
    ];
  }
  


  private loadMenuFromStorage(): MenuItem[] {
    const storedData = localStorage.getItem(this.localStorageMenuKey);
    return storedData ? JSON.parse(storedData) : [
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
  }

  

  constructor() {
    // 🔄 Escuchar mensajes para sincronización
    this.broadcastChannel.onmessage = (event) => {
      if (event.data.type === 'update') {
        this.tables = this.loadTablesFromStorage();
        this.menu = this.loadMenuFromStorage();
        this.waiters = this.loadWaitersFromStorage();
        this.tablesSubject.next([...this.tables]);
      }
    };
  }

  private tablesSubject = new BehaviorSubject<Table[]>(this.tables);
  tables$ = this.tablesSubject.asObservable();

    // 🔄 Enviar actualización a otros dispositivos
    private notifyUpdate(): void {
      this.broadcastChannel.postMessage({ type: 'update' });
    }
  

  getTables() {
    return this.tables;
  }

  getMenu() {
    return this.menu;
  }


  private saveTablesToStorage(): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.tables));
    this.notifyUpdate();
  }

  private notifyTablesChange(): void {
    this.tablesSubject.next([...this.tables]);
    this.saveTablesToStorage();
  }

  assignWaiterToTable(tableId: number, waiterId: string): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      table.waiterId = waiterId;
      this.getLinkedTables(tableId).forEach(linkedTable => {
        linkedTable.waiterId = waiterId;
      });
      this.notifyTablesChange();
      this.notifyUpdate();
    }
  }

  unassignWaiterFromTable(tableId: number): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      table.waiterId = undefined;
      this.getLinkedTables(tableId).forEach(linkedTable => {
        linkedTable.waiterId = undefined;
      });
      this.notifyTablesChange();
      this.notifyUpdate();
    }
  }

  releaseTable(tableId: number): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      table.orders = [];
      table.available = true;
      this.unassignWaiterFromTable(tableId);

      const linkedTables = this.getLinkedTables(tableId);
      linkedTables.forEach(linkedTable => {
        linkedTable.orders = [];
        linkedTable.available = true;
        linkedTable.controlledBy = undefined;
        linkedTable.linkedTables = linkedTable.linkedTables.filter(id => id !== tableId);
      });

      table.linkedTables = [];
      table.controlledBy = undefined;
      this.notifyTablesChange();
      this.notifyUpdate();
    }
  }

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
      this.getLinkedTables(tableId).forEach(linkedTable => {
        linkedTable.orders = [...table.orders];
        linkedTable.available = false;
      });
      table.available = false;
      this.notifyTablesChange();
    }
  }

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
    if (table) {
      table.orders = table.orders.filter(order => order.id !== orderId);
      this.notifyTablesChange();
    }
  }

  addTable(name: string): void {
    const newTable: Table = {
      id: this.tables.length > 0 ? Math.max(...this.tables.map(t => t.id)) + 1 : 1,
      name,
      available: true,
      orders: [],
      linkedTables: []
    };
    this.tables.push(newTable);
    this.notifyUpdate();
    this.notifyTablesChange();
  }
  
  editTable(tableId: number, newName: string, newAvailability: boolean): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      table.name = newName;
      table.available = newAvailability;
      this.notifyUpdate();
      this.notifyTablesChange();
    }
  }
  
  deleteTable(tableId: number): void {
    this.tables = this.tables.filter(t => t.id !== tableId);
    this.notifyUpdate();
    this.notifyTablesChange();
  }

  //MENU

  private saveMenuToStorage(): void {
    localStorage.setItem(this.localStorageMenuKey, JSON.stringify(this.menu));
    this.notifyUpdate();
  }

  addMenuItem(name: string, price: number): void {
    const newItem: MenuItem = {
      id: this.menu.length > 0 ? Math.max(...this.menu.map(m => m.id)) + 1 : 1,
      name,
      price,
      quantity: 1
    };
    this.menu.push(newItem);
    this.notifyUpdate();
    this.notifyMenuChange();
  }
  
  editMenuItem(itemId: number, newName: string, newPrice: number): void {
    const item = this.menu.find(m => m.id === itemId);
    if (item) {
      item.name = newName;
      item.price = newPrice;
      this.notifyUpdate();
      this.notifyMenuChange();
    }
  }
  
  deleteMenuItem(itemId: number): void {
    this.menu = this.menu.filter(m => m.id !== itemId);
    this.notifyUpdate();
    this.notifyMenuChange();
  }
  
  // Notificar cambios en el menú
  private notifyMenuChange(): void {
   localStorage.setItem(this.localStorageMenuKey, JSON.stringify(this.menu));
  }

  //WAITERS
  private saveWaitersToStorage(): void {
    localStorage.setItem(this.localStorageWaitersKey, JSON.stringify(this.waiters));
    this.notifyUpdate();
  }

  private notifyWaitersChange(): void {
    this.saveWaitersToStorage();
  }

  addWaiter(name: string): void {
    const newId = this.waiters.length > 0 ? Math.max(...this.waiters.map(w => w.id)) + 1 : 1;
    const newWaiter: Waiter = { id: newId, name };
    this.waiters.push(newWaiter);
     this.notifyUpdate();
    this.notifyWaitersChange();
  }

  editWaiter(waiterId: number, newName: string): void {
    const waiter = this.waiters.find(w => w.id === waiterId);
    if (waiter) {
      waiter.name = newName;
      this.notifyUpdate();
      this.notifyWaitersChange();
    }
  }

  deleteWaiter(waiterId: number): void {
    this.waiters = this.waiters.filter(w => w.id !== waiterId);
    this.notifyUpdate();
    this.notifyWaitersChange();
  }

  getWaiters(): Waiter[] {
    return this.waiters;
  }
  
}