import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface CashMovement {
  id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

// Resumen de una caja (abierta: en vivo; cerrada: con el arqueo)
export interface CashRegisterSummary {
  id: string;
  open: boolean;
  openedAt: string;
  openedByName: string;
  closedAt: string | null;
  closedByName: string | null;
  note: string;
  countedAmount: number | null;
  difference: number | null;
  // los importes vienen en null para quien no es admin mientras la caja está abierta (conteo a ciegas)
  sales: { count: number; totalAmount: number | null; discountTotal: number | null; tipsTotal: number | null };
  byMethod: { method: string; amount: number; count: number }[];
  tipsByWaiter: { waiterName: string; amount: number }[];
  // sales y expected vienen en null para quien no es admin mientras la caja está abierta (conteo a ciegas)
  cash: { opening: number; sales: number | null; in: number; out: number; expected: number | null };
  movements: CashMovement[];
}

export interface CashState {
  open: boolean;
  requireOpenRegister: boolean;
  register: CashRegisterSummary | null;
}

export interface CashHistoryRow {
  id: string;
  openedAt: string;
  openedByName: string;
  closedAt: string | null;
  closedByName: string | null;
  openingAmount: number;
  expectedAmount: number | null;
  countedAmount: number | null;
  difference: number | null;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class CashService {
  private readonly baseUrl = `${environment.apiUrl}/cash`;
  private state = new BehaviorSubject<CashState | null>(null);

  // Estado conocido de la caja (null hasta que llega la primera respuesta)
  readonly state$ = this.state.asObservable();

  constructor(private http: HttpClient) {}

  get value(): CashState | null {
    return this.state.value;
  }

  refresh(): Observable<CashState> {
    return this.http.get<CashState>(`${this.baseUrl}/current`).pipe(tap((s) => this.state.next(s)));
  }

  open(openingAmount: number): Observable<CashRegisterSummary> {
    return this.http.post<CashRegisterSummary>(`${this.baseUrl}/open`, { openingAmount }).pipe(tap(() => this.refresh().subscribe()));
  }

  addMovement(input: { type: 'IN' | 'OUT'; amount: number; reason: string }): Observable<CashRegisterSummary> {
    return this.http.post<CashRegisterSummary>(`${this.baseUrl}/movements`, input).pipe(tap(() => this.refresh().subscribe()));
  }

  close(input: { countedAmount: number; note?: string }): Observable<CashRegisterSummary> {
    return this.http.post<CashRegisterSummary>(`${this.baseUrl}/close`, input).pipe(tap(() => this.refresh().subscribe()));
  }

  history(): Observable<CashHistoryRow[]> {
    return this.http.get<CashHistoryRow[]>(`${this.baseUrl}/registers`);
  }

  detail(id: string): Observable<CashRegisterSummary> {
    return this.http.get<CashRegisterSummary>(`${this.baseUrl}/registers/${id}`);
  }
}
