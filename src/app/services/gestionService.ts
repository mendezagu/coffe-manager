import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environmentMongo } from 'src/environmets/environmentMongo';
import { map, Observable, catchError, throwError } from 'rxjs';

export interface MenuItem {
  menuItem: any;
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
  controlledBy?: string | null;
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

  // Manejo de errores
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error inesperado';
    if (error.error instanceof ErrorEvent) {
      // Error en el cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error en el servidor
      errorMessage = `Error ${error.status}: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // 📌 Tables
  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.apiUrl}/tables`).pipe(
      map((tables: any[]) => tables.map(table => ({
        ...table,
        id: table._id,
        available: table.orders.length === 0,
        waiterId: table.waiterId,
        waiterName: table.waiter ? table.waiter.name : 'Sin asignar',
      }))),
      catchError(this.handleError)
    );
  }

  addTable(name: string): Observable<Table> {
    return this.http.post<Table>(`${this.apiUrl}/tables`, { name, available: true, orders: [], linkedTables: [] })
      .pipe(catchError(this.handleError));
  }

  editTable(tableId: string, newName: string, newAvailability: boolean): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}`, { name: newName, available: newAvailability })
      .pipe(catchError(this.handleError));
  }

  deleteTable(tableId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/tables/${tableId}`)
      .pipe(catchError(this.handleError));
  }

  // 📌 Agregar ítems a la mesa
  addItemsToTable(tableId: string, items: MenuItem[]): Observable<Table> {
    const formattedItems = items.map(item => ({
      id: item._id,
      quantity: item.quantity || 1,
      name: item.name
    }));

    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/add-items`, { items: formattedItems }).pipe(
      map((table: Table) => {
        table.available = table.orders.length === 0;
        return table;
      }),
      catchError(this.handleError)
    );
  }

  // Eliminar órdenes de la mesa
  deleteOrdersFromTable(tableId: string, orderIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/remove-order`, { orderIds }).pipe(
      map((table: Table) => {
        table.available = table.orders.length === 0;
        return table;
      }),
      catchError(this.handleError)
    );
  }

  // Obtener información de la mesa
  getTableById(tableId: string): Observable<Table> {
    return this.http.get<Table>(`${this.apiUrl}/tables/${tableId}`).pipe(
      map((table: any) => ({
        ...table,
        id: table._id
      })),
      catchError(this.handleError)
    );
  }

  // Liberar mesa
  releaseTable(tableId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/tables/${tableId}/release`, {})
      .pipe(catchError(this.handleError));
  }

  // Resetear mesa
  resetTable(tableId: string): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/reset`, {}).pipe(
      map((table) => ({
        ...table,
        waiterId: null,
        waiterName: 'No asignado',
        linkedTables: [],
        orders: [],
        available: true,
        controlledBy: null,
      })),
      catchError(this.handleError)
    );
  }

  // 📌 Vincular mesas
  linkTables(tableId: string, linkedTableIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/link-tables`, { linkedTableIds }).pipe(
      map((table: Table) => {
        const mainTable = this.tables.find((t: { id: string }) => t.id === tableId);
        if (mainTable) {
          mainTable.linkedTables = linkedTableIds;
          mainTable.available = false;
        }

        linkedTableIds.forEach(linkedTableId => {
          const linkedTable = this.tables.find((t: { id: string }) => t.id === linkedTableId);
          if (linkedTable) {
            linkedTable.controlledBy = tableId;
            linkedTable.available = false;
          }
        });

        return table;
      }),
      catchError(this.handleError)
    );
  }

  // 📌 Desvincular mesas
  unlinkTables(tableId: string, linkedTableIds: string[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/unlink-tables`, { linkedTableIds }).pipe(
      map((table: Table) => ({
        ...table,
        linkedTables: table.linkedTables
      })),
      catchError(this.handleError)
    );
  }

// Obtener balance
getBalance(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/balances`).pipe(
    catchError(this.handleError)
  );
}

// Agregar una entrada al balance
addBalanceEntry(entry: { tableName: string; waiterName: string; totalAmount: number }): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/balances`, entry).pipe(
    catchError(this.handleError)
  );
}

// Eliminar todos los balances
deleteAllBalances(): Observable<{ message: string }> {
  return this.http.delete<{ message: string }>(`${this.apiUrl}/balances`).pipe(
    catchError(this.handleError)
  );
}

  // 📌 Menu Items
  getMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.apiUrl}/menu`).pipe(
      catchError(this.handleError)
    );
  }

  addMenuItem(name: string, price: number): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu`, { name, price, quantity: 1 }).pipe(
      catchError(this.handleError)
    );
  }

  editMenuItem(itemId: string, newName: string, newPrice: number): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/menu/${itemId}`, { name: newName, price: newPrice }).pipe(
      catchError(this.handleError)
    );
  }

  deleteMenuItem(itemId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/menu/${itemId}`).pipe(
      catchError(this.handleError)
    );
  }

  // 📌 Waiters
  getWaiters(): Observable<Waiter[]> {
    return this.http.get<Waiter[]>(`${this.apiUrl}/waiters`).pipe(
      catchError(this.handleError)
    );
  }

  addWaiter(name: string): Observable<Waiter> {
    return this.http.post<Waiter>(`${this.apiUrl}/waiters`, { name }).pipe(
      catchError(this.handleError)
    );
  }

  editWaiter(waiterId: string, newName: string): Observable<Waiter> {
    return this.http.put<Waiter>(`${this.apiUrl}/waiters/${waiterId}`, { name: newName }).pipe(
      catchError(this.handleError)
    );
  }

  deleteWaiter(waiterId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/waiters/${waiterId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Buscar mozo por nombre
  getWaiterByName(name: string): Observable<Waiter> {
    return this.http.get<Waiter>(`${this.apiUrl}/waiter-by-name/${name}`).pipe(
      catchError(this.handleError)
    );
  }

  // Obtener mozo por ID
  getWaiterById(waiterId: string): Observable<Waiter> {
    return this.http.get<Waiter>(`${this.apiUrl}/waiters/${waiterId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Asignar mozo a una mesa
  assignWaiterToTable(tableId: string, waiterId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/tables/${tableId}/assign-waiter`, { waiterId }).pipe(
      catchError(this.handleError)
    );
  }

}