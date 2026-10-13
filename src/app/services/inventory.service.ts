import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environmentMongo } from 'src/environments/environmentMongo';

export const STOCK_UNITS = [
  { value: 'unidad', label: 'unidades' },
  { value: 'g', label: 'gramos (g)' },
  { value: 'kg', label: 'kilos (kg)' },
  { value: 'ml', label: 'mililitros (ml)' },
  { value: 'l', label: 'litros (l)' },
];

export type StockStatus = 'ok' | 'low' | 'out';

export interface StockItem {
  _id: string;
  name: string;
  unit: string;
  onHand: number;
  minStock: number;
  costPerUnit: number;
  active: boolean;
  committed: number; // pedido en mesas abiertas, todavía sin cobrar
  available: number; // existencias menos lo comprometido
  status: StockStatus;
  usedIn: number; // en cuántas recetas y opciones se usa
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  name: string;
  unit: string;
  type: 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT';
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  supplier: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface RecipeIngredient {
  stockItemId: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface DishRecipe {
  menuItemId: string;
  name: string;
  price: number;
  isPromo: boolean;
  categoryId: string | null;
  ingredients: RecipeIngredient[];
  cost: number | null;
  margin: number | null;
  marginPct: number | null;
}

export interface OptionRecipe {
  optionId: string;
  groupId: string;
  groupName: string;
  name: string;
  priceDelta: number;
  active: boolean;
  ingredients: (RecipeIngredient & { replacesStockItemId: string | null })[];
}

export interface CountResult {
  items: { stockItemId: string; name: string; unit: string; expected: number; counted: number; difference: number; value: number }[];
  differences: number;
  totalValue: number;
}

export interface InventorySummary {
  itemsCount: number;
  lowCount: number;
  outCount: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly baseUrl = `${environmentMongo.apiUrl}/inventory`;

  constructor(private http: HttpClient) {}

  summary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.baseUrl}/summary`);
  }

  items(): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(`${this.baseUrl}/items`);
  }

  createItem(input: { name: string; unit: string; minStock?: number; costPerUnit?: number; initialQuantity?: number }): Observable<StockItem> {
    return this.http.post<StockItem>(`${this.baseUrl}/items`, input);
  }

  updateItem(id: string, input: { name?: string; minStock?: number; costPerUnit?: number; active?: boolean }): Observable<StockItem> {
    return this.http.put<StockItem>(`${this.baseUrl}/items/${id}`, input);
  }

  deleteItem(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/items/${id}`);
  }

  purchase(id: string, input: { quantity: number; unitCost?: number; supplier?: string; note?: string }): Observable<StockItem> {
    return this.http.post<StockItem>(`${this.baseUrl}/items/${id}/purchase`, input);
  }

  waste(id: string, input: { quantity: number; reason: string }): Observable<StockItem> {
    return this.http.post<StockItem>(`${this.baseUrl}/items/${id}/waste`, input);
  }

  adjust(id: string, input: { counted: number; note?: string }): Observable<StockItem> {
    return this.http.post<StockItem>(`${this.baseUrl}/items/${id}/adjust`, input);
  }

  count(input: { counts: { stockItemId: string; counted: number }[]; note?: string }): Observable<CountResult> {
    return this.http.post<CountResult>(`${this.baseUrl}/count`, input);
  }

  movements(filter: { stockItemId?: string; limit?: number } = {}): Observable<StockMovement[]> {
    let params = new HttpParams();
    if (filter.stockItemId) params = params.set('stockItemId', filter.stockItemId);
    if (filter.limit) params = params.set('limit', String(filter.limit));
    return this.http.get<StockMovement[]>(`${this.baseUrl}/movements`, { params });
  }

  recipes(): Observable<DishRecipe[]> {
    return this.http.get<DishRecipe[]>(`${this.baseUrl}/recipes`);
  }

  setRecipe(menuItemId: string, ingredients: { stockItemId: string; quantity: number }[]): Observable<DishRecipe> {
    return this.http.put<DishRecipe>(`${this.baseUrl}/recipes/${menuItemId}`, { ingredients });
  }

  options(): Observable<OptionRecipe[]> {
    return this.http.get<OptionRecipe[]>(`${this.baseUrl}/options`);
  }

  setOptionIngredients(
    optionId: string,
    ingredients: { stockItemId: string; quantity: number; replacesStockItemId?: string | null }[],
  ): Observable<OptionRecipe> {
    return this.http.put<OptionRecipe>(`${this.baseUrl}/options/${optionId}`, { ingredients });
  }
}

// Mensaje de un error del servidor (o uno de reserva si no hay)
export function errorText(err: any, fallback: string): string {
  const msg = err?.error?.message;
  return (Array.isArray(msg) ? msg.join('. ') : msg) || fallback;
}
