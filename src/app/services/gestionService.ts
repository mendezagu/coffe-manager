import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environmentMongo } from 'src/environmets/environment';
import { map, Observable } from 'rxjs';

export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  quantity?: number;
}

export interface Table {
  id: string;
  name: string;
  available: boolean;
  orders: MenuItem[];
  linkedTables: string[];
  controlledBy?: string | null;  // Acepta null
  waiterId?: any;
  waiterName?: string;
  waiter?: Waiter;
}

export interface Waiter {
  _id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class GestionService {
  private apiUrl = environmentMongo.apiUrl;
  tables: any;

  constructor(private http: HttpClient) {}

  // 📌 Tables
  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.apiUrl}/tables`).pipe(
      map((tables: any[]) => {
        return tables.map(table => {
          // Actualizar el estado de la mesa en función de si tiene órdenes
          table.available = table.orders.length === 0; // Si no tiene órdenes, está disponible
          return {
            ...table,
            id: table._id,
            waiterId: table.waiterId,
            waiterName: table.waiter ? table.waiter.name : 'Sin asignar',  // Asignar el nombre si existe
          };
        });
      })
    );
  }

  addTable(name: string): Observable<Table> {
    return this.http.post<Table>(`${this.apiUrl}/tables`, { name, available: true, orders: [], linkedTables: [] });
  }

  editTable(tableId: string, newName: string, newAvailability: boolean): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}`, { name: newName, available: newAvailability });
  }

  deleteTable(tableId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/tables/${tableId}`);
  }

// 📌 Agregar ítems a la mesa
addItemsToTable(tableId: string, items: MenuItem[]): Observable<Table> {
  const formattedItems = items.map(item => ({
    id: item._id,
    quantity: item.quantity || 1,
    name: item.name
  }));
  console.log(formattedItems, 'FORMATO');

  return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/add-items`, { items: formattedItems }).pipe(
    map((table: Table) => {
      // Verificar si la mesa tiene al menos un producto en orders y cambiar el estado
      table.available = table.orders.length === 0; // Si no tiene órdenes, está disponible

      return table;
    })
  );
}

  // Eliminar una orden específica de una mesa
  deleteOrdersFromTable(tableId: string, orderIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/remove-order`, { orderIds }).pipe(
      map((table: Table) => {
        // Actualizar la disponibilidad de la mesa después de eliminar órdenes
        table.available = table.orders.length === 0; // Si no tiene órdenes, está disponible
        return table;
      })
    );
  }

//obtener la info de las mesas 
  getTableById(tableId: string): Observable<Table> {
    return this.http.get<Table>(`${this.apiUrl}/tables/${tableId}`).pipe(
      map((table: any) => ({
        ...table,
        id: table._id  // Asegura que se mapea _id a id
      }))
    );
  }

  //libera las mesas 
  releaseTable(tableId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/tables/${tableId}/release`, {}); // Ajusta la ruta y payload según tu backend
  }

  resetTable(tableId: string): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/reset`, {}).pipe(
      map((table) => ({
        ...table,
        waiterId: null,  // En lugar de undefined, usa null si el backend lo maneja mejor
        waiterName: 'No asignado',
        linkedTables: [],
        orders: [],
        available: true,
        controlledBy: null,
      }))
    );
  }

  // 📌 Vincular mesas
  linkTables(tableId: string, linkedTableIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/link-tables`, { linkedTableIds }).pipe(
      map((table: Table) => {
        // Actualizar la mesa principal
        const mainTable = this.tables.find((t: { id: string; }) => t.id === tableId);
        if (mainTable) {
          mainTable.linkedTables = linkedTableIds;
          mainTable.available = false; // Ocupa la mesa principal
        }
  
        // Actualizar las mesas vinculadas
        linkedTableIds.forEach(linkedTableId => {
          const linkedTable = this.tables.find((t: { id: string; }) => t.id === linkedTableId);
          if (linkedTable) {
            linkedTable.controlledBy = tableId; // Asigna la mesa principal como controladora
            linkedTable.available = false; // Marca la mesa como ocupada
          }
        });
  
        return table;
      })
    );
  }

  // 📌 Desvincular mesas
  unlinkTables(tableId: string, linkedTableIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/unlink-tables`, { linkedTableIds }).pipe(
      map((table: Table) => {
        return {
          ...table,
          linkedTables: table.linkedTables
        };
      })
    );
  }

  // 📌 Menu Items
  getMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.apiUrl}/menu`);
  }

  addMenuItem(name: string, price: number): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu`, { name, price, quantity: 1 });
  }

  editMenuItem(itemId: string, newName: string, newPrice: number): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/menu/${itemId}`, { name: newName, price: newPrice });
  }

  deleteMenuItem(itemId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/menu/${itemId}`);
  }

  // 📌 Waiters
  getWaiters(): Observable<Waiter[]> {
    return this.http.get<Waiter[]>(`${this.apiUrl}/waiters`);
  }

  addWaiter(name: string): Observable<Waiter> {
    return this.http.post<Waiter>(`${this.apiUrl}/waiters`, { name });
  }

  editWaiter(waiterId: string, newName: string): Observable<Waiter> {
    return this.http.put<Waiter>(`${this.apiUrl}/waiters/${waiterId}`, { name: newName });
  }

  deleteWaiter(waiterId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/waiters/${waiterId}`);
  }

   // Buscar un mozo por su nombre
   getWaiterByName(name: string): Observable<Waiter> {
    return this.http.get<Waiter>(`${this.apiUrl}/waiter-by-name/${name}`);
  }

  // ✅ Nueva función para obtener un mozo por su ID
  getWaiterById(waiterId: string): Observable<Waiter> {
    return this.http.get<Waiter>(`${this.apiUrl}/waiters/${waiterId}`);
  }

 // ✅ Asignar un mozo a una mesa solo con su ID
assignWaiterToTable(tableId: string, waiterId: string): Observable<any> {
  return this.http.put(`${this.apiUrl}/tables/${tableId}/assign-waiter`, { waiterId });
}
}