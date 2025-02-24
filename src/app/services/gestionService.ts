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
  controlledBy?: string;
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

  constructor(private http: HttpClient) {}

  // 📌 Tables
  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.apiUrl}/tables`).pipe(
      map((tables: any[]) => {
        return tables.map(table => ({
          ...table,
          id: table._id,
          waiterId: table.waiterId,
          waiterName: table.waiter ? table.waiter.name : 'Sin asignar'  // Aquí asignamos el nombre si existe
        }));
        
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
      name:item.name
    }));
    console.log(formattedItems,'FORMATO');
    
  
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/add-items`, { items: formattedItems });
  }

  // Eliminar una orden específica de una mesa
  deleteOrdersFromTable(tableId: string, orderIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/remove-order`, { orderIds });
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