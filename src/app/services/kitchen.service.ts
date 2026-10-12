import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environmentMongo } from 'src/environments/environmentMongo';

export type KitchenStatus = 'PENDING' | 'PREPARING' | 'READY';

export interface KitchenOrder {
  id: string;
  tableId: string;
  tableName: string;
  waiterName: string | null;
  itemName: string;
  quantity: number;
  note: string;
  status: KitchenStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class KitchenService {
  private readonly baseUrl = `${environmentMongo.apiUrl}/kitchen`;

  constructor(private http: HttpClient) {}

  list(): Observable<KitchenOrder[]> {
    return this.http.get<KitchenOrder[]>(`${this.baseUrl}/orders`);
  }

  setStatus(id: string, status: KitchenStatus): Observable<{ id: string; status: KitchenStatus }> {
    return this.http.put<{ id: string; status: KitchenStatus }>(`${this.baseUrl}/orders/${id}/status`, { status });
  }

  // Cambia el estado de varias líneas a la vez (una comanda completa)
  setManyStatus(ids: string[], status: KitchenStatus): Observable<{ updated: number; status: KitchenStatus }> {
    return this.http.put<{ updated: number; status: KitchenStatus }>(`${this.baseUrl}/orders/status`, { ids, status });
  }
}
