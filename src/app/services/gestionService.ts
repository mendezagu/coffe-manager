import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { map, Observable, catchError, throwError, BehaviorSubject, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OrderModifier } from 'src/app/utils/modifiers';

export interface MenuItem {
  menuItem: any;
  _id: string;
  name: string;
  price: number;
  quantity?: number;
  note?: string;
  isPromo?: boolean;
  discount?: number;
  categoryId?: string | null;
  // ids de los modificadores que ofrece el plato (el detalle está en getModifiers())
  modifierGroupIds?: string[];
  // precio propio de algunas opciones en este plato (cada tamaño): { idOpción: precio final }
  optionPrices?: Record<string, number>;
  imageUrl?: string | null; // foto del plato
  // opciones elegidas al pedirlo (solo en la selección del mozo) y en las órdenes ya hechas
  selectedModifiers?: OrderModifier[];
  modifiers?: OrderModifier[];
  // identifica un plato con sus opciones dentro de la selección del mozo
  lineKey?: string;
  // solo en pantallas de cobro: precio del plato sin los extras (price incluye los extras)
  basePrice?: number;
  // con inventario: cuántas unidades se pueden preparar con lo que hay (0 = agotado; null = no se controla)
  availableUnits?: number | null;
}

export type ModifierSelection = 'SINGLE' | 'MULTIPLE';

export interface ModifierOption {
  _id: string;
  name: string;
  priceDelta: number;
  position: number;
  active: boolean;
  // con inventario: el insumo de esta opción se agotó
  outOfStock?: boolean;
}

export interface ModifierGroup {
  _id: string;
  name: string;
  selection: ModifierSelection;
  required: boolean;
  position: number;
  options: ModifierOption[];
  itemsCount?: number;
}

export interface ModifierGroupInput {
  name?: string;
  selection?: ModifierSelection;
  required?: boolean;
  options?: { id?: string; name: string; priceDelta?: number; active?: boolean }[];
}

// Datos del plato que se ven en la carta (todos opcionales)
export interface MenuCarta {
  description?: string;
  badge?: string;
  badgeColor?: string;
  featured?: boolean;
  visibleInMenu?: boolean;
  // precio final de cada tamaño en este plato; sin la clave, la opción suma lo de siempre
  optionPrices?: Record<string, number | null>;
}

export type Destination = 'KITCHEN' | 'BAR';

export interface Category {
  _id: string;
  name: string;
  position: number;
  destination: Destination;
  // carta: subtítulo, texto a la derecha del título y formato de los platos
  subtitle?: string | null;
  tagline?: string | null;
  layout?: 'grid' | 'list' | 'hero';
  itemsCount?: number;
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
  private apiUrl = environment.apiUrl;
  tables: any;

  constructor(private http: HttpClient) {}

  // Manejo de errores
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error inesperado';
    if (error.error instanceof ErrorEvent) {
      // Error en el cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error en el servidor: si trae un mensaje pensado para la persona (ej: "No hay stock suficiente…"), se usa ese
      const serverMessage = error.error?.message;
      errorMessage = serverMessage
        ? Array.isArray(serverMessage) ? serverMessage.join('. ') : serverMessage
        : `Error ${error.status}: ${error.message}`;
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
        // La API manda el nombre del mozo en `waiterName` (null si no tiene). Antes se miraba `table.waiter`, que no
        // existe, y el nombre se pisaba siempre con "Sin asignar" hasta que otra pantalla lo reponía.
        waiterName: table.waiterName ?? (table.waiter ? table.waiter.name : 'Sin asignar'),
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
  // requestId: identifica este envío; si el servidor lo recibe repetido, carga los platos una sola vez
  addItemsToTable(tableId: string, items: MenuItem[], requestId?: string): Observable<Table> {
    const formattedItems = items.map(item => ({
      id: item._id,
      quantity: item.quantity || 1,
      name: item.name,
      note: item.note || '',
      // solo se envían los ids: el servidor valida y pone los precios
      modifiers: (item.selectedModifiers ?? []).map(m => m.optionId)
    }));

    return this.http.put<Table>(`${this.apiUrl}/tables/${tableId}/add-items`, { items: formattedItems, ...(requestId ? { requestId } : {}) }).pipe(
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

// Detalle de una venta (ítems, descuentos, quién cobró)
getBalanceDetail(id: string): Observable<any> {
  return this.http.get<any>(`${this.apiUrl}/balances/${id}`);
}

// Cobra la mesa y la libera en una sola operación. El total lo calcula el servidor:
// acá solo se informan el método de pago y los descuentos pedidos (solo admin).
// Los errores del servidor se dejan pasar tal cual para poder mostrar su mensaje.
checkout(
  tableId: string,
  body: {
    checkoutId: string;
    payments: { method: string; amount: number; tendered?: number }[];
    tip?: number;
    globalDiscount: number;
    items: { orderId: string; discount: number }[];
    // cobrar solo una parte de la mesa (división por platos); sin esto se cobra todo
    lines?: { orderId: string; quantity: number }[];
    // voucher de hotel (uno por mesa): fija el descuento y no se combina con otros
    voucherCode?: string;
  }
): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/tables/${tableId}/checkout`, body);
}

  // Venta por mostrador: se cobra sin mesa. El servidor calcula el total con los precios del menú.
  counterCheckout(body: {
    checkoutId: string;
    items: { menuItemId: string; quantity: number }[];
    takeaway: boolean;
    payments: { method: string; amount: number; tendered?: number }[];
    tip?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/counter/checkout`, body);
  }

  // Muestra u oculta un plato en la carta online y en el pedido por QR
  setMenuVisibility(itemId: string, visibleInMenu: boolean): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/menu/${itemId}`, { visibleInMenu }).pipe(tap(() => this.menuCache$.next(null)));
  }

  // Fija o quita un producto de los favoritos de la caja del mostrador (solo admin)
  setFavorite(itemId: string, isFavorite: boolean): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/menu/${itemId}`, { isFavorite }).pipe(tap(() => this.menuCache$.next(null)));
  }

  // 📌 Modificadores (tamaño, leche, extras…). Los errores del servidor pasan tal cual.
  getModifiers(): Observable<ModifierGroup[]> {
    return this.http.get<ModifierGroup[]>(`${this.apiUrl}/modifiers`);
  }

  addModifierGroup(input: ModifierGroupInput): Observable<ModifierGroup> {
    return this.http.post<ModifierGroup>(`${this.apiUrl}/modifiers`, input);
  }

  editModifierGroup(id: string, input: ModifierGroupInput): Observable<ModifierGroup> {
    return this.http.put<ModifierGroup>(`${this.apiUrl}/modifiers/${id}`, input);
  }

  deleteModifierGroup(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/modifiers/${id}`);
  }

  reorderModifierGroups(ids: string[]): Observable<ModifierGroup[]> {
    return this.http.put<ModifierGroup[]>(`${this.apiUrl}/modifiers/reorder`, { ids });
  }

  applyModifierToCategory(id: string, categoryId: string): Observable<{ assigned: number; categoryItems: number }> {
    return this.http.post<{ assigned: number; categoryItems: number }>(`${this.apiUrl}/modifiers/${id}/apply-to-category`, { categoryId });
  }

  // 📌 Categorías del menú. Los errores del servidor pasan tal cual para poder mostrar su mensaje.
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  addCategory(name: string, destination: Destination = 'KITCHEN'): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, { name, destination });
  }

  editCategory(id: string, changes: { name?: string; destination?: Destination; subtitle?: string; tagline?: string; layout?: string }): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${id}`, changes);
  }

  deleteCategory(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/categories/${id}`);
  }

  reorderCategories(ids: string[]): Observable<Category[]> {
    return this.http.put<Category[]>(`${this.apiUrl}/categories/reorder`, { ids });
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

  addMenuItem(name: string, price: number, isPromo: boolean = false, categoryId: string | null = null): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu`, { name, price, quantity: 1, isPromo, categoryId }).pipe(
      tap(() => this.menuCache$.next(null)), // Invalidar caché
      catchError(this.handleError)
    );
  }

  // categoryId: id para asignarla, null para quitarla
  editMenuItem(itemId: string, newName: string, newPrice: number, isPromo: boolean = false, categoryId: string | null = null, modifierGroupIds?: string[], carta?: MenuCarta): Observable<MenuItem> {
    // modifierGroupIds: lista completa de lo que ofrece el plato; sin enviarla no se tocan
    return this.http.put<MenuItem>(`${this.apiUrl}/menu/${itemId}`, { name: newName, price: newPrice, isPromo, categoryId, modifierGroupIds, ...(carta ?? {}) }).pipe(
      tap(() => this.menuCache$.next(null)), // Invalidar caché
      catchError(this.handleError)
    );
  }

  // Carga platos con precio por tamaño desde una planilla (crea o actualiza por nombre)
  importSizes(input: { groupName: string; sizes: string[]; rows: { name: string; category: string; prices: (number | null)[] }[] }): Observable<{ created: number; updated: number; total: number; groupName: string }> {
    return this.http.post<{ created: number; updated: number; total: number; groupName: string }>(`${this.apiUrl}/menu/import-sizes`, input).pipe(
      tap(() => this.menuCache$.next(null)),
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