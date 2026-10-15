import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SalesReport {
  range: { from: string; to: string; tz: string };
  summary: {
    salesCount: number;
    totalAmount: number;
    averageTicket: number;
    grossTotal: number;
    discountTotal: number;
    itemsSold: number;
    salesWithoutDetail: number;
    tipsTotal: number;
    // ganancia sobre lo vendido con receta (costo conocido); revenueWithoutCost es lo vendido sin costo
    costTotal: number;
    profit: number;
    profitMarginPct: number | null;
    revenueWithoutCost: number;
  };
  byDay: { date: string; salesCount: number; totalAmount: number }[];
  items: { name: string; quantity: number; amount: number; cost: number | null; profit: number | null }[];
  byWaiter: { name: string; salesCount: number; totalAmount: number; tips: number }[];
  byPayment: { method: string; salesCount: number; totalAmount: number }[];
}

// Resumen del momento para el Inicio del administrador
export interface LiveSummary {
  sales: { total: number; count: number };
  yesterday: { total: number; count: number }; // ayer hasta esta misma hora
  changePct: number | null; // null si ayer a esta hora no hubo ventas
  averageStayMinutes: number | null; // null si hoy no se cerró ninguna mesa
  staysCount: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private http: HttpClient) {}

  live(): Observable<LiveSummary> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return this.http.get<LiveSummary>(`${environment.apiUrl}/reports/live`, { params: new HttpParams().set('tz', tz) });
  }

  // from/to: YYYY-MM-DD (inclusive). La zona horaria es la del navegador: define dónde empieza cada día.
  sales(from: string, to: string): Observable<SalesReport> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const params = new HttpParams().set('from', from).set('to', to).set('tz', tz);
    return this.http.get<SalesReport>(`${environment.apiUrl}/reports/sales`, { params });
  }
}
