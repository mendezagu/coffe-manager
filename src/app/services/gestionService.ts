import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environmentMongo } from 'src/environments/environmentMongo';
import { map, Observable, catchError, throwError, BehaviorSubject, of } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface MenuItem {
  menuItem: any;
  _id: string;
  name: string;
  price: number;
  quantity?: number;
  note?: string;
  isPromo?: boolean;
  discount?: number;
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
  sectorId?: string | null;
  sectorName?: string | null;
  sectorPosition?: number | null;
}

export interface Waiter {
  _id: string;
  name: string;
}

export interface Sector {
  _id: string;
  name: string;
  position?: number;
}

@Injectable({
  providedIn: 'root',
})
export class GestionService {
  // Dentro de la clase GestionService
private menuCache$ = new BehaviorSubject<MenuItem[] | null>(null);
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

  addTable(name: string, sectorId?: string | null): Observable<Table> {
    return this.http.post<Table>(`${this.apiUrl}/tables`, { name, available: true, orders: [], linkedTables: [], sectorId: sectorId || null })
      .pipe(catchError(this.handleError));
  }

  // sectorId: undefined = no cambiar el sector, null = dejar la mesa sin sector
  editTable(tableId: string, newName: string, newAvailability: boolean, sectorId?: string | null): Observable<Table> {
    const body: any = { name: newName, available: newAvailability };
    if (sectorId !== undefined) {
      body.sectorId = sectorId;
    }
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}`, body)
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
      name: item.name,
      note: item.note || ''
    }));

    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/add-items`, { items: formattedItems }).pipe(
      map((table: Table) => {
        table.available = table.orders.length === 0;
        return table;
      }),
      catchError(this.handleError)
    );
  }

  // Actualizar cantidades de órdenes puntuales (sin tocar el resto de la mesa)
  updateOrderQuantities(tableId: string, updates: { orderId: string; quantity: number }[]): Observable<Table> {
    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/update-quantities`, { updates }).pipe(
      map((table: Table) => {
        table.available = table.orders.length === 0;
        return table;
      }),
      catchError(this.handleError)
    );
  }

  // Eliminar órdenes de la mesa
deleteOrdersFromTable(tableId: string, orderIds: string[]): Observable<Table> {
  return this.http.put<{ message: string; table: Table }>(
    `${this.apiUrl}/tables/${tableId}/remove-order`,
    { orderIds }
  ).pipe(
    map((response) => {
      const table = response.table;
      table.available = table.orders?.length === 0;
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
addBalanceEntry(entry: { tableName: string; waiterName: string; totalAmount: number; paymentMethod: string }): Observable<any> {
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
// Nueva versión de getMenu
getMenu(): Observable<MenuItem[]> {
  const cached = this.menuCache$.getValue();
  if (cached) {
    return of(cached);
  }

  return this.http.get<MenuItem[]>(`${this.apiUrl}/menu`).pipe(
    tap(menuItems => this.menuCache$.next(menuItems)), // cache result
    catchError(this.handleError)
  );
}

// Método opcional para forzar actualización
refreshMenu(): Observable<MenuItem[]> {
  return this.http.get<MenuItem[]>(`${this.apiUrl}/menu`).pipe(
    tap(menuItems => this.menuCache$.next(menuItems)),
    catchError(this.handleError)
  );
}

  addMenuItem(name: string, price: number, isPromo: boolean = false): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu`, { name, price, quantity: 1, isPromo }).pipe(
      tap(() => this.menuCache$.next(null)), // Invalidar caché
      catchError(this.handleError)
    );
  }

  editMenuItem(itemId: string, newName: string, newPrice: number, isPromo: boolean = false): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/menu/${itemId}`, { name: newName, price: newPrice, isPromo }).pipe(
      tap(() => this.menuCache$.next(null)), // Invalidar caché
      catchError(this.handleError)
    );
  }

  deleteMenuItem(itemId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/menu/${itemId}`).pipe(
      tap(() => this.menuCache$.next(null)), // Invalidar caché
      catchError(this.handleError)
    );
  }

  // 📌 Waiters
  // 📌 Sectores
  // El backend responde 409 si el nombre ya existe; se conserva su mensaje para mostrarlo al usuario.
  private handleSectorError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || 'Ocurrió un error inesperado';
    console.error(`Error ${error.status}: ${message}`);
    return throwError(() => new Error(Array.isArray(message) ? message.join(', ') : message));
  }

  getSectors(): Observable<Sector[]> {
    return this.http.get<Sector[]>(`${this.apiUrl}/sectors`).pipe(
      catchError(this.handleError)
    );
  }

  addSector(name: string): Observable<Sector> {
    return this.http.post<Sector>(`${this.apiUrl}/sectors`, { name }).pipe(
      catchError(err => this.handleSectorError(err))
    );
  }

  editSector(sectorId: string, newName: string): Observable<Sector> {
    return this.http.put<Sector>(`${this.apiUrl}/sectors/${sectorId}`, { name: newName }).pipe(
      catchError(err => this.handleSectorError(err))
    );
  }

  // Recibe los ids de todos los sectores en el orden deseado
  reorderSectors(ids: string[]): Observable<Sector[]> {
    return this.http.put<Sector[]>(`${this.apiUrl}/sectors/reorder`, { ids }).pipe(
      catchError(this.handleError)
    );
  }

  deleteSector(sectorId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/sectors/${sectorId}`).pipe(
      catchError(this.handleError)
    );
  }

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

    // 📌 Logs de acciones
saveLog(action: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = { action, timestamp };
  const existingLogs = JSON.parse(localStorage.getItem('appLogs') || '[]');
  existingLogs.push(logEntry);
  localStorage.setItem('appLogs', JSON.stringify(existingLogs));
  console.log('[LOG GUARDADO]', logEntry); // 👈 Agrega esto temporalmente
}

getLogs(): { action: string; timestamp: string }[] {
  return JSON.parse(localStorage.getItem('appLogs') || '[]');
}

clearLogs(): void {
  localStorage.removeItem('appLogs');
}

}