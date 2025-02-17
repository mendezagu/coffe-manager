import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export interface MenuItem {
  id: any;
  name: any;
  price: any;
  quantity?: any;
}

export interface Table {
  id: any;
  name: any;
  available: boolean;
  orders: MenuItem[];
  linkedTables: any[];
  controlledBy?: any;
  waiterId?: any;
}

export interface Waiter {
  id: any;
  name: any;
}

@Injectable({
  providedIn: 'root'
})
export class CoffeService {
  tables: Table[] = [];
  menu: MenuItem[] = [];
  waiters: Waiter[] = [];

  private tablesSubject = new BehaviorSubject<Table[]>(this.tables);
  tables$ = this.tablesSubject.asObservable();

  constructor(private firestore: AngularFirestore) {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.firestore.collection<Table>('tables').valueChanges().subscribe(data => {
      this.tables = data;
      this.tablesSubject.next([...this.tables]);
    });

    this.firestore.collection<MenuItem>('menu').valueChanges().subscribe(data => {
      this.menu = data;
    });

    this.firestore.collection<Waiter>('waiters').valueChanges().subscribe(data => {
      this.waiters = data;
    });
  }

   updateFirestore(collection: string, id: number, data: any): void {
    this.firestore.collection(collection).doc(id.toString()).set(data, { merge: true });
  }

  getTables() {
    return this.tables;
  }

  getMenu() {
    return this.menu;
  }

  getWaiters() {
    return this.waiters;
  }

  addTable(name: string): void {
    const newTableRef = this.firestore.collection('tables').doc();
    const newTable: Table = {
      id: newTableRef.ref.id,
      name,
      available: true,
      orders: [],
      linkedTables: []
    };
    newTableRef.set(newTable);
  }

  editTable(tableId: number, newName: string, newAvailability: boolean): void {
    this.updateFirestore('tables', tableId, { name: newName, available: newAvailability });
  }

  deleteTable(tableId: number): void {
    this.firestore.collection('tables').doc(tableId.toString()).delete();
  }

  releaseTable(tableId: any): void {
    const table = this.tables.find(t => t.id === tableId);
  
    if (table) {
      const linkedTableIds = [...table.linkedTables];
  
      table.orders = [];
      table.waiterId = undefined;
      table.available = true;
      table.controlledBy = undefined;
      table.linkedTables = [];
  
      // **Actualizar Firestore para la mesa administradora**
      this.updateFirestore('tables', tableId, {
        orders: [],
        waiterId: null,
        available: true,
        controlledBy: null,
        linkedTables: []
      });
  
      // **Liberar también las mesas vinculadas**
      linkedTableIds.forEach(linkedTableId => {
        const linkedTable = this.tables.find(t => t.id === linkedTableId);
        if (linkedTable) {
          linkedTable.orders = [];
          linkedTable.waiterId = undefined;
          linkedTable.available = true;
          linkedTable.controlledBy = undefined;
          linkedTable.linkedTables = [];
  
          this.updateFirestore('tables', linkedTableId, {
            orders: [],
            waiterId: null,
            available: true,
            controlledBy: null,
            linkedTables: []
          });
        }
      });
  
      this.tablesSubject.next([...this.tables]); // Emitir cambios para actualizar la UI
    }
  }

  addMenuItem(name: string, price: number): void {
    const newItem: MenuItem = {
      id: this.menu.length > 0 ? Math.max(...this.menu.map(m => m.id)) + 1 : 1,
      name,
      price,
      quantity: 1
    };
    this.firestore.collection('menu').doc(newItem.id.toString()).set(newItem);
  }

  editMenuItem(itemId: number, newName: string, newPrice: number): void {
    this.updateFirestore('menu', itemId, { name: newName, price: newPrice });
  }

  deleteMenuItem(itemId: number): void {
    this.firestore.collection('menu').doc(itemId.toString()).delete();
  }

  addWaiter(name: string): void {
    const newWaiter: Waiter = {
      id: this.waiters.length > 0 ? Math.max(...this.waiters.map(w => w.id)) + 1 : 1,
      name
    };
    this.firestore.collection('waiters').doc(newWaiter.id.toString()).set(newWaiter);
  }

  editWaiter(waiterId: number, newName: string): void {
    this.updateFirestore('waiters', waiterId, { name: newName });
  }

  deleteWaiter(waiterId: number): void {
    this.firestore.collection('waiters').doc(waiterId.toString()).delete();
  }

 linkMultipleTables(baseTableId: any, tableIdsToLink: any[]): void {
  const baseTable = this.tables.find(t => t.id === baseTableId);

  if (baseTable) {
    baseTable.available = false; // La mesa administradora se marca como ocupada si tiene órdenes
    const linkedTableIds: any[] = [];

    tableIdsToLink.forEach(tableId => {
      const table = this.tables.find(t => t.id === tableId);
      if (table && !baseTable.linkedTables.includes(tableId)) {
        baseTable.linkedTables.push(tableId);
        table.linkedTables.push(baseTableId);
        table.controlledBy = baseTableId;
        table.available = false; // Marcar las mesas vinculadas como ocupadas también
        linkedTableIds.push(tableId);
      }
    });

    // **Actualizar Firestore para la mesa administradora**
    this.updateFirestore('tables', baseTableId, {
      linkedTables: baseTable.linkedTables,
      available: false // Marcar como ocupada
    });

    // **Actualizar Firestore para todas las mesas vinculadas**
    linkedTableIds.forEach(tableId => {
      this.updateFirestore('tables', tableId, {
        linkedTables: this.tables.find(t => t.id === tableId)?.linkedTables,
        controlledBy: baseTableId,
        available: false // También se marcan como ocupadas
      });
    });

    this.tablesSubject.next([...this.tables]); // Emitir cambios para actualizar la UI
  }
}

  removeOrderFromTable(tableId: any, orderId: number): void {
    const table = this.tables.find(t => t.id === tableId);
    if (table) {
      table.orders = table.orders.filter(order => order.id !== orderId);
      this.updateFirestore('tables', tableId, { orders: table.orders });
    }
  }
}
